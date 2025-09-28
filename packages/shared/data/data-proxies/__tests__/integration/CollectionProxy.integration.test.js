/**
 * Integration tests for CollectionProxy class with real DataStore
 * Tests the complete workflow of CollectionProxy extending Handle with actual DataStore operations
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DataStore } from '@legion/data-store';
import { DataStoreDataSource } from '../../src/DataStoreDataSource.js';
import { CollectionProxy } from '../../src/CollectionProxy.js';

describe('CollectionProxy Integration Tests', () => {
  let dataStore;
  let resourceManager;

  beforeEach(async () => {
    // Create new DataStore instance for each test
    dataStore = new DataStore();
    
    // Create ResourceManager adapter
    resourceManager = new DataStoreDataSource(dataStore);
  });

  afterEach(() => {
    // Clean up resources
    if (dataStore) {
      // DataStore doesn't have a destroy method, so we just clear the reference
      dataStore = null;
    }
    resourceManager = null;
  });

  describe('Basic Collection Operations with Real DataStore', () => {
    it('should create collection and query entities from DataStore', async () => {
      // Add test entities to DataStore using proper DataScript keyword format
      const transactionData = [
        ['+', 1, ':type', 'user'],
        ['+', 1, ':name', 'Alice'],
        ['+', 1, ':age', 25],
        ['+', 2, ':type', 'user'],
        ['+', 2, ':name', 'Bob'],
        ['+', 2, ':age', 30],
        ['+', 3, ':type', 'post'],
        ['+', 3, ':title', 'Hello World'],
      ];
      
      const transactionResult = await resourceManager.transact(transactionData);
      expect(transactionResult.success).toBe(true);
      
      // Create collection spec to find all users
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'user']]
      };
      
      // Create CollectionProxy
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Test collection length
      const length = await collection.getLength();
      expect(length).toBe(2);
      
      // Test collection isEmpty
      const isEmpty = await collection.getIsEmpty();
      expect(isEmpty).toBe(false);
      
      // Test toArray
      const entities = await collection.toArray();
      expect(entities).toHaveLength(2);
      
      // Verify entity data
      const entityNames = entities.map(e => e[':name']).sort();
      expect(entityNames).toEqual(['Alice', 'Bob']);
    });

    it('should handle empty collections correctly', async () => {
      // Create collection spec for non-existent entities
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'nonexistent']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Test empty collection
      const length = await collection.getLength();
      expect(length).toBe(0);
      
      const isEmpty = await collection.getIsEmpty();
      expect(isEmpty).toBe(true);
      
      const entities = await collection.toArray();
      expect(entities).toHaveLength(0);
      
      const first = await collection.getFirst();
      expect(first).toBeNull();
      
      const last = await collection.getLast();
      expect(last).toBeNull();
    });

    it('should support first/last entity operations', async () => {
      // Add test entities with specific ordering
      const transactionData = [
        ['+', 1, ':type', 'item'],
        ['+', 1, ':order', 1],
        ['+', 1, ':name', 'First'],
        ['+', 2, ':type', 'item'],
        ['+', 2, ':order', 2],
        ['+', 2, ':name', 'Second'],
        ['+', 3, ':type', 'item'],
        ['+', 3, ':order', 3],
        ['+', 3, ':name', 'Third'],
      ];
      
      await resourceManager.transact(transactionData);
      
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'item']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Get first entity
      const first = await collection.getFirst();
      expect(first).not.toBeNull();
      expect(first[':type']).toBe('item');
      expect([1, 2, 3]).toContain(first[':db/id']);
      
      // Get last entity
      const last = await collection.getLast();
      expect(last).not.toBeNull();
      expect(last[':type']).toBe('item');
      expect([1, 2, 3]).toContain(last[':db/id']);
      
      // First and last might be the same if there's only one entity,
      // but in this case we have 3, so they should be different
      // (though the order isn't guaranteed by DataScript)
    });
  });

  describe('Collection Iteration with Real DataStore', () => {
    beforeEach(async () => {
      // Setup common test data
      const transactionData = [
        ['+', 1, ':type', 'person'],
        ['+', 1, ':name', 'Alice'],
        ['+', 1, ':age', 25],
        ['+', 1, ':active', true],
        ['+', 2, ':type', 'person'],
        ['+', 2, ':name', 'Bob'],
        ['+', 2, ':age', 30],
        ['+', 2, ':active', false],
        ['+', 3, ':type', 'person'],
        ['+', 3, ':name', 'Charlie'],
        ['+', 3, ':age', 35],
        ['+', 3, ':active', true],
      ];
      
      await resourceManager.transact(transactionData);
    });

    it('should support forEach iteration', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'person']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      const names = [];
      await collection.forEach(entity => {
        names.push(entity[':name']);
      });
      
      expect(names).toHaveLength(3);
      expect(names.sort()).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should support map operations', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'person']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      const names = await collection.map(entity => entity[':name']);
      
      expect(names).toHaveLength(3);
      expect(names.sort()).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should support filter operations', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'person']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      const activePersons = await collection.filter(entity => entity[':active'] === true);
      
      expect(activePersons).toHaveLength(2);
      const activeNames = activePersons.map(p => p[':name']).sort();
      expect(activeNames).toEqual(['Alice', 'Charlie']);
    });

    it('should support find operations', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'person']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      const bob = await collection.find(entity => entity[':name'] === 'Bob');
      
      expect(bob).not.toBeUndefined();
      expect(bob[':name']).toBe('Bob');
      expect(bob[':age']).toBe(30);
      expect(bob[':active']).toBe(false);
      
      const nonExistent = await collection.find(entity => entity[':name'] === 'David');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Collection Updates with Real DataStore', () => {
    beforeEach(async () => {
      // Setup test data
      const transactionData = [
        ['+', 1, ':type', 'task'],
        ['+', 1, ':title', 'Task 1'],
        ['+', 1, ':status', 'pending'],
        ['+', 2, ':type', 'task'],
        ['+', 2, ':title', 'Task 2'],
        ['+', 2, ':status', 'pending'],
        ['+', 3, ':type', 'task'],
        ['+', 3, ':title', 'Task 3'],
        ['+', 3, ':status', 'completed'],
      ];
      
      await resourceManager.transact(transactionData);
    });

    it('should support updateAll operations', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'task']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Update all tasks
      const result = await collection.updateAll({ ':priority': 'high' });
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(3);
      expect(result.errors).toHaveLength(0);
      
      // Verify all tasks have the new priority
      const entities = await collection.toArray();
      expect(entities).toHaveLength(3);
      entities.forEach(entity => {
        expect(entity[':priority']).toBe('high');
      });
    });

    it('should support updateWhere operations', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'task']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Update only pending tasks
      const result = await collection.updateWhere(
        entity => entity[':status'] === 'pending',
        { ':assignee': 'Alice' }
      );
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(2); // Only 2 pending tasks
      expect(result.errors).toHaveLength(0);
      
      // Verify only pending tasks were updated
      const entities = await collection.toArray();
      const pendingTasks = entities.filter(e => e[':status'] === 'pending');
      const completedTasks = entities.filter(e => e[':status'] === 'completed');
      
      expect(pendingTasks).toHaveLength(2);
      pendingTasks.forEach(task => {
        expect(task[':assignee']).toBe('Alice');
      });
      
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0][':assignee']).toBeUndefined();
    });
  });

  describe('Complex Collection Specifications with Real DataStore', () => {
    beforeEach(async () => {
      // Setup complex test data
      const transactionData = [
        // Users
        ['+', 1, ':type', 'user'],
        ['+', 1, ':name', 'Alice'],
        ['+', 1, ':role', 'admin'],
        ['+', 1, ':active', true],
        ['+', 2, ':type', 'user'],
        ['+', 2, ':name', 'Bob'],
        ['+', 2, ':role', 'user'],
        ['+', 2, ':active', true],
        ['+', 3, ':type', 'user'],
        ['+', 3, ':name', 'Charlie'],
        ['+', 3, ':role', 'user'],
        ['+', 3, ':active', false],
        // Projects
        ['+', 4, ':type', 'project'],
        ['+', 4, ':name', 'Project A'],
        ['+', 4, ':owner', 1],
        ['+', 5, ':type', 'project'],
        ['+', 5, ':name', 'Project B'],
        ['+', 5, ':owner', 2],
      ];
      
      await resourceManager.transact(transactionData);
    });

    it('should handle collections with multiple where clauses', async () => {
      // Find active admin users
      const collectionSpec = {
        find: ['?e'],
        where: [
          ['?e', ':type', 'user'],
          ['?e', ':role', 'admin'],
          ['?e', ':active', true]
        ]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      const length = await collection.getLength();
      expect(length).toBe(1); // Only Alice matches all criteria
      
      const entities = await collection.toArray();
      expect(entities).toHaveLength(1);
      expect(entities[0][':name']).toBe('Alice');
      expect(entities[0][':role']).toBe('admin');
      expect(entities[0][':active']).toBe(true);
    });

    it('should handle collections with complex find patterns', async () => {
      // Find all projects and their owners (join-like query)
      const collectionSpec = {
        find: ['?project', '?owner'],
        where: [
          ['?project', ':type', 'project'],
          ['?project', ':owner', '?owner']
        ]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      const results = await collection.toArray();
      expect(results).toHaveLength(2); // Two projects
      
      // Results should be arrays with [project, owner] pairs
      // Note: The exact format depends on how our ResourceManager handles multi-variable finds
    });
  });

  describe('Subscription Support with Real DataStore', () => {
    it('should support collection subscriptions', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'document']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Create subscription
      const callbacks = [];
      const subscription = collection.subscribe(collectionSpec, (data) => {
        callbacks.push(data);
      });
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Note: Real subscription testing would require triggering actual data changes
      // and verifying callbacks are called. For now, we just test the interface exists.
      
      // Cleanup subscription
      subscription.unsubscribe();
    });
  });

  describe('Error Handling with Real DataStore', () => {
    it('should handle invalid collection specifications', async () => {
      // Invalid collection spec
      const invalidSpec = {
        find: [], // Empty find clause should cause issues
        where: [['?e', ':type', 'user']]
      };
      
      expect(() => new CollectionProxy(resourceManager, invalidSpec)).toThrow('Collection specification must have find clause');
      
      // Test another type of invalid spec
      const noWhereSpec = {
        find: ['?e']
        // Missing where clause
      };
      
      expect(() => new CollectionProxy(resourceManager, noWhereSpec)).toThrow('Collection specification must have where clause');
    });

    it('should handle DataStore query errors gracefully', async () => {
      // This test would require mocking DataStore to throw errors
      // For now, we'll test with a malformed query that DataScript might reject
      const problematicSpec = {
        find: ['?e'],
        where: [
          // Malformed where clause that might cause DataScript to error
          ['?e', null, 'value'] // null attribute name
        ]
      };
      
      const collection = new CollectionProxy(resourceManager, problematicSpec);
      
      // The query should either work (returning empty results) or throw an error we can catch
      try {
        const length = await collection.getLength();
        expect(typeof length).toBe('number');
      } catch (error) {
        // If DataScript throws an error, we should handle it gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Entity Proxy Integration', () => {
    beforeEach(async () => {
      const transactionData = [
        ['+', 1, ':type', 'user'],
        ['+', 1, ':name', 'Alice'],
        ['+', 1, ':email', 'alice@example.com'],
        ['+', 2, ':type', 'user'],
        ['+', 2, ':name', 'Bob'],
        ['+', 2, ':email', 'bob@example.com'],
      ];
      
      await resourceManager.transact(transactionData);
    });

    it('should provide entity proxies for collection entities', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'user']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Get entity proxy for first user
      const entityProxy = collection.getEntityProxy(1);
      
      expect(entityProxy).toBeDefined();
      expect(entityProxy.entityId).toBe(1);
      expect(entityProxy.resourceManager).toBe(resourceManager);
    });

    it('should cache entity proxies', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'user']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Get same entity proxy twice
      const proxy1 = collection.getEntityProxy(1);
      const proxy2 = collection.getEntityProxy(1);
      
      // Should be the same instance (cached)
      expect(proxy1).toBe(proxy2);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':type', 'user']]
      };
      
      const collection = new CollectionProxy(resourceManager, collectionSpec);
      
      // Create some entity proxies to cache
      collection.getEntityProxy(1);
      collection.getEntityProxy(2);
      
      // Verify proxies are cached
      expect(collection._entityProxies.size).toBe(2);
      
      // Cleanup
      collection.destroy();
      
      // Verify cache is cleared
      expect(collection._entityProxies.size).toBe(0);
    });
  });
});