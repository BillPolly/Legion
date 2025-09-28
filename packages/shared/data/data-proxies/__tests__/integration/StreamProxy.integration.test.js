/**
 * Integration tests for StreamProxy class with real DataStore
 * Tests the complete workflow of StreamProxy extending Handle with actual DataStore operations
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DataStore } from '@legion/data-store';
import { DataStoreDataSource } from '../../src/DataStoreDataSource.js';
import { StreamProxy } from '../../src/StreamProxy.js';

describe('StreamProxy Integration Tests', () => {
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

  describe('Basic StreamProxy Operations with Real DataStore', () => {
    it('should create StreamProxy and stream query results from DataStore', async () => {
      // Add test entities to DataStore using proper DataScript keyword format
      const transactionData = [
        ['+', 1, ':type', 'stream-item'],
        ['+', 1, ':name', 'Stream Item 1'],
        ['+', 1, ':status', 'active'],
        ['+', 2, ':type', 'stream-item'],
        ['+', 2, ':name', 'Stream Item 2'],
        ['+', 2, ':status', 'inactive'],
        ['+', 3, ':type', 'other-item'],
        ['+', 3, ':name', 'Other Item'],
        ['+', 3, ':status', 'active'],
      ];
      
      const transactionResult = await resourceManager.transact(transactionData);
      expect(transactionResult.success).toBe(true);
      
      // Create stream query specification
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'stream-item']]
      };
      
      // Create StreamProxy
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Test stream value() method
      const results = streamProxy.value();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2); // Should find 2 stream-items
      
      // Results should be entity IDs
      const entityIds = results.map(result => Array.isArray(result) ? result[0] : result);
      expect(entityIds.sort()).toEqual([1, 2]);
    });

    it('should handle empty streams correctly', () => {
      // Create stream spec for non-existent entities
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'nonexistent-type']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Test empty stream
      const results = streamProxy.value();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should support additional query operations', async () => {
      // Setup test data
      const transactionData = [
        ['+', 1, ':type', 'document'],
        ['+', 1, ':category', 'tech'],
        ['+', 1, ':priority', 'high'],
        ['+', 2, ':type', 'document'],
        ['+', 2, ':category', 'business'],
        ['+', 2, ':priority', 'low'],
        ['+', 3, ':type', 'document'],
        ['+', 3, ':category', 'tech'],
        ['+', 3, ':priority', 'medium'],
      ];
      
      await resourceManager.transact(transactionData);
      
      // Create stream for all documents
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'document']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Test additional query for tech documents only
      const techQuerySpec = {
        find: ['?e'],
        where: [
          ['?e', ':type', 'document'],
          ['?e', ':category', 'tech']
        ]
      };
      
      const techResults = streamProxy.query(techQuerySpec);
      expect(Array.isArray(techResults)).toBe(true);
      expect(techResults.length).toBe(2); // Should find 2 tech documents
      
      // Extract entity IDs
      const techEntityIds = techResults.map(result => Array.isArray(result) ? result[0] : result);
      expect(techEntityIds.sort()).toEqual([1, 3]);
    });
  });

  describe('StreamProxy Filter Operations with Real DataStore', () => {
    beforeEach(async () => {
      // Setup common test data
      const transactionData = [
        ['+', 1, ':type', 'task'],
        ['+', 1, ':name', 'Task A'],
        ['+', 1, ':priority', 'high'],
        ['+', 1, ':completed', false],
        ['+', 2, ':type', 'task'],
        ['+', 2, ':name', 'Task B'],
        ['+', 2, ':priority', 'low'],
        ['+', 2, ':completed', true],
        ['+', 3, ':type', 'task'],
        ['+', 3, ':name', 'Task C'],
        ['+', 3, ':priority', 'high'],
        ['+', 3, ':completed', false],
        ['+', 4, ':type', 'task'],
        ['+', 4, ':name', 'Task D'],
        ['+', 4, ':priority', 'medium'],
        ['+', 4, ':completed', true],
      ];
      
      await resourceManager.transact(transactionData);
    });

    it('should support filter operations on stream results', async () => {
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'task']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Test filter for high priority items
      // Note: We need to simulate a filter predicate since we can't easily get entity attributes in the filter
      const highPriorityFilter = (entityResult) => {
        // In a real scenario, the filter would have access to full entity data
        // For now, we'll filter based on entity IDs (1 and 3 are high priority)
        const entityId = Array.isArray(entityResult) ? entityResult[0] : entityResult;
        return entityId === 1 || entityId === 3;
      };
      
      const filteredProxy = streamProxy.filter(highPriorityFilter);
      
      // Test filtered results
      const results = filteredProxy.value();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      const entityIds = results.map(result => Array.isArray(result) ? result[0] : result);
      expect(entityIds.sort()).toEqual([1, 3]);
    });

    it('should chain multiple filters correctly', async () => {
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'task']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // First filter: entities 1, 2, 3
      const firstFilter = (entityResult) => {
        const entityId = Array.isArray(entityResult) ? entityResult[0] : entityResult;
        return entityId <= 3;
      };
      
      // Second filter: entities 1, 3 (odd IDs)
      const secondFilter = (entityResult) => {
        const entityId = Array.isArray(entityResult) ? entityResult[0] : entityResult;
        return entityId % 2 === 1;
      };
      
      const doubleFilteredProxy = streamProxy.filter(firstFilter).filter(secondFilter);
      
      const results = doubleFilteredProxy.value();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      const entityIds = results.map(result => Array.isArray(result) ? result[0] : result);
      expect(entityIds.sort()).toEqual([1, 3]);
    });
  });

  describe('StreamProxy Subscription Operations with Real DataStore', () => {
    it('should create subscriptions for stream monitoring', async () => {
      // Note: This test focuses on subscription creation rather than actual change notifications
      // since DataStore subscription testing requires more complex setup
      
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'monitored-item']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Create subscription with callback only (monitors current stream)
      const callbacks = [];
      const subscription1 = streamProxy.subscribe((data) => {
        callbacks.push(data);
      });
      
      expect(subscription1).toBeDefined();
      expect(typeof subscription1.unsubscribe).toBe('function');
      expect(subscription1.id).toBeDefined();
      
      // Create subscription with custom query
      const customQuerySpec = {
        find: ['?e'],
        where: [['?e', ':status', 'new']]
      };
      
      const subscription2 = streamProxy.subscribe(customQuerySpec, (data) => {
        callbacks.push(data);
      });
      
      expect(subscription2).toBeDefined();
      expect(typeof subscription2.unsubscribe).toBe('function');
      expect(subscription2.id).toBeDefined();
      expect(subscription2.id).not.toBe(subscription1.id);
      
      // Verify subscriptions are tracked
      expect(streamProxy._subscriptions.size).toBe(2);
      
      // Cleanup subscriptions
      subscription1.unsubscribe();
      subscription2.unsubscribe();
      
      expect(streamProxy._subscriptions.size).toBe(0);
    });

    it('should support filtered stream subscriptions', async () => {
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'notification']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Create filtered stream
      const importantFilter = (entityResult) => {
        const entityId = Array.isArray(entityResult) ? entityResult[0] : entityResult;
        return entityId <= 2; // Simulate "important" items
      };
      
      const filteredProxy = streamProxy.filter(importantFilter);
      
      // Create subscription on filtered stream
      const callbacks = [];
      const subscription = filteredProxy.subscribe((data) => {
        callbacks.push(data);
      });
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Filtered proxy should also track subscriptions
      expect(filteredProxy._subscriptions.size).toBe(1);
      
      // Cleanup
      subscription.unsubscribe();
    });
  });

  describe('Complex StreamProxy Queries with Real DataStore', () => {
    beforeEach(async () => {
      // Setup complex test data with relationships
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
        ['+', 4, ':name', 'Project Alpha'],
        ['+', 4, ':owner', 1],
        ['+', 4, ':status', 'active'],
        ['+', 5, ':type', 'project'],
        ['+', 5, ':name', 'Project Beta'],
        ['+', 5, ':owner', 2],
        ['+', 5, ':status', 'pending'],
        ['+', 6, ':type', 'project'],
        ['+', 6, ':name', 'Project Gamma'],
        ['+', 6, ':owner', 3],
        ['+', 6, ':status', 'inactive'],
      ];
      
      await resourceManager.transact(transactionData);
    });

    it('should handle complex multi-variable query streams', async () => {
      // Stream all active projects with their owners (join-like query)
      const complexQuerySpec = {
        find: ['?project', '?owner'],
        where: [
          ['?project', ':type', 'project'],
          ['?project', ':status', 'active'],
          ['?project', ':owner', '?owner']
        ]
      };
      
      const streamProxy = new StreamProxy(resourceManager, complexQuerySpec);
      
      const results = streamProxy.value();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1); // Only Project Alpha is active
      
      // Result should be [projectId, ownerId]
      if (results.length > 0) {
        const [projectId, ownerId] = results[0];
        expect(projectId).toBe(4); // Project Alpha
        expect(ownerId).toBe(1);   // Alice
      }
    });

    it('should support multi-constraint stream queries', async () => {
      // Stream active users with admin or user roles
      const multiConstraintSpec = {
        find: ['?e'],
        where: [
          ['?e', ':type', 'user'],
          ['?e', ':active', true]
          // Note: DataScript doesn't support OR conditions directly in where clauses
          // In practice, you'd handle this with multiple queries or in application logic
        ]
      };
      
      const streamProxy = new StreamProxy(resourceManager, multiConstraintSpec);
      
      const results = streamProxy.value();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2); // Alice and Bob are active
      
      const entityIds = results.map(result => Array.isArray(result) ? result[0] : result);
      expect(entityIds.sort()).toEqual([1, 2]);
    });
  });

  describe('StreamProxy Error Handling with Real DataStore', () => {
    it('should handle malformed queries gracefully', async () => {
      // Test with malformed query that might cause DataScript to error
      const malformedQuerySpec = {
        find: ['?e'],
        where: [
          ['?e', null, 'value'] // null attribute name
        ]
      };
      
      const streamProxy = new StreamProxy(resourceManager, malformedQuerySpec);
      
      // The query should either work (returning empty results) or throw an error we can catch
      try {
        const results = streamProxy.value();
        // If it succeeds, results should be an array
        expect(Array.isArray(results)).toBe(true);
      } catch (error) {
        // If DataScript throws an error, we should handle it gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle ResourceManager query errors', async () => {
      // Create a problematic query specification
      const problematicSpec = {
        find: ['?e'],
        where: [
          // This might cause issues depending on DataScript implementation
          ['?e', ':type', undefined]
        ]
      };
      
      const streamProxy = new StreamProxy(resourceManager, problematicSpec);
      
      try {
        const results = streamProxy.value();
        // If successful, should return array
        expect(Array.isArray(results)).toBe(true);
      } catch (error) {
        // If it fails, should be a proper error
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('StreamProxy Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'cleanup-test']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Create some subscriptions
      const subscription1 = streamProxy.subscribe(jest.fn());
      const subscription2 = streamProxy.subscribe(jest.fn());
      
      // Verify subscriptions are tracked
      expect(streamProxy._subscriptions.size).toBe(2);
      
      // Test destruction
      expect(streamProxy.isDestroyed()).toBe(false);
      
      streamProxy.destroy();
      
      expect(streamProxy.isDestroyed()).toBe(true);
      expect(streamProxy._subscriptions.size).toBe(0);
    });

    it('should handle subscription cleanup errors gracefully', async () => {
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'error-test']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Mock a subscription that throws on unsubscribe
      const mockSubscription = {
        id: 'error-sub',
        unsubscribe: jest.fn().mockImplementation(() => {
          throw new Error('Unsubscribe failed');
        })
      };
      
      // Manually add the problematic subscription
      streamProxy._subscriptions.add(mockSubscription);
      
      // Destruction should not throw error
      expect(() => {
        streamProxy.destroy();
      }).not.toThrow();
      
      expect(streamProxy.isDestroyed()).toBe(true);
    });
  });

  describe('StreamProxy Integration with DataStore Features', () => {
    it('should work with DataStore transaction results', async () => {
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'transaction-test']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Initially empty
      let results = streamProxy.value();
      expect(results.length).toBe(0);
      
      // Add some entities via transaction
      const transactionData = [
        ['+', 10, ':type', 'transaction-test'],
        ['+', 10, ':data', 'first'],
        ['+', 11, ':type', 'transaction-test'],
        ['+', 11, ':data', 'second'],
      ];
      
      const transactionResult = await resourceManager.transact(transactionData);
      expect(transactionResult.success).toBe(true);
      
      // Now stream should see the new entities
      results = streamProxy.value();
      expect(results.length).toBe(2);
      
      const entityIds = results.map(result => Array.isArray(result) ? result[0] : result);
      expect(entityIds.sort()).toEqual([10, 11]);
    });

    it('should handle entity updates and retractions', async () => {
      // Initial data
      const initialData = [
        ['+', 20, ':type', 'mutable-test'],
        ['+', 20, ':status', 'draft'],
        ['+', 21, ':type', 'mutable-test'],
        ['+', 21, ':status', 'published'],
      ];
      
      await resourceManager.transact(initialData);
      
      const streamQuerySpec = {
        find: ['?e'],
        where: [['?e', ':type', 'mutable-test']]
      };
      
      const streamProxy = new StreamProxy(resourceManager, streamQuerySpec);
      
      // Should see both entities
      let results = streamProxy.value();
      expect(results.length).toBe(2);
      
      // Retract one entity
      const retractionData = [
        ['-', 21, ':type', 'mutable-test'],
        ['-', 21, ':status', 'published'],
      ];
      
      await resourceManager.transact(retractionData);
      
      // Stream should now see only one entity
      results = streamProxy.value();
      expect(results.length).toBe(1);
      
      const entityIds = results.map(result => Array.isArray(result) ? result[0] : result);
      expect(entityIds).toEqual([20]);
    });
  });
});