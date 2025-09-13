/**
 * Query-with-Update Pattern Integration Tests
 * Testing atomic update-then-query operations that ensure query results include updates
 */

import { DataStoreProxy } from '../src/DataStoreProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { createTestStore, createSampleData } from './setup.js';

describe('Query-with-Update Pattern', () => {
  let store;
  let sampleData;
  let proxy;
  
  beforeEach(() => {
    store = createTestStore();
    sampleData = createSampleData(store);
    proxy = new DataStoreProxy(store);
  });
  
  describe('Basic Query-with-Update', () => {
    test('should execute update before query and include updates in results', () => {
      // Initial state - 2 active users
      const initialActive = store.query({
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      });
      expect(initialActive.length).toBe(2);
      
      // Query with update - activate Charlie and query active users
      const result = store.queryWithUpdate({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        update: [
          { ':db/id': sampleData.users.charlie, ':user/active': true }
        ]
      });
      
      // Result should include Charlie now (3 active users)
      expect(result.results.length).toBe(3);
      expect(result.results.map(r => r[0])).toContain(sampleData.users.charlie);
    });
    
    test('should create new entities and include them in query results', () => {
      // Create new user and query it in same operation
      const result = store.queryWithUpdate({
        find: ['?e', '?name'],
        where: [['?new-user', ':user/name', '?name']], // Use the tempid in where clause
        update: [
          { ':db/id': '?new-user', ':user/name': 'Diana', ':user/active': true, ':user/age': 28 }
        ]
      });
      
      // Should find the newly created user
      expect(result.results.length).toBe(1);
      expect(result.results[0][1]).toBe('Diana');
      
      // Also test without tempid in where clause
      const result2 = store.queryWithUpdate({
        find: ['?e'],
        where: [['?e', ':user/name', 'Diana']],
        update: [
          { ':db/id': '?new-user2', ':user/name': 'Eve', ':user/active': true, ':user/age': 29 }
        ]
      });
      
      // Should find the newly created user
      expect(result2.results.length).toBe(1);
      expect(result2.results[0][0]).toBeGreaterThan(0); // Entity ID should be a positive number
    });
    
    test('should handle multiple updates in single operation', () => {
      // Update multiple users and query them
      const result = store.queryWithUpdate({
        find: ['?e', '?status'],
        where: [
          ['?e', ':user/status', '?status'],
          ['?e', ':user/active', true]
        ],
        update: [
          { ':db/id': sampleData.users.alice, ':user/status': 'online' },
          { ':db/id': sampleData.users.bob, ':user/status': 'away' }
        ]
      });
      
      // Should return both users with their updated statuses
      expect(result.results.length).toBe(2);
      const statuses = result.results.map(r => r[1]);
      expect(statuses).toContain('online');
      expect(statuses).toContain('away');
    });
  });
  
  describe('Proxy Integration with Query-with-Update', () => {
    
    test('should create appropriate proxy for query-with-update results', () => {
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
    
    test('should support entity proxy creation from query-with-update', () => {
      // Create new entity and get it as EntityProxy
      const entityResult = proxy.queryWithUpdate({
        find: ['?e'],
        where: [['?e', ':user/name', 'Eve']],
        update: [
          { ':db/id': '?new-user', ':user/name': 'Eve', ':user/age': 26 }
        ]
      });
      
      expect(entityResult).toBeInstanceOf(EntityProxy);
      expect(entityResult.value()[':user/name']).toBe('Eve');
    });
    
    test('should handle streaming queries with updates', () => {
      // Update and create stream for monitoring
      const streamResult = proxy.queryWithUpdate({
        find: ['?e', '?name'],
        where: [['?e', ':user/active', true], ['?e', ':user/name', '?name']],
        update: [
          { ':db/id': sampleData.users.charlie, ':user/active': true }
        ]
      });
      
      expect(streamResult).toBeInstanceOf(StreamProxy);
      const results = streamResult.value();
      expect(results.length).toBe(3);
    });
  });
  
  describe('Transactional Consistency', () => {
    test('should ensure updates are atomic with query', () => {
      // The real implementation ensures atomicity - updates happen first, then query
      const result = store.queryWithUpdate({
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        update: [
          { ':db/id': sampleData.users.charlie, ':user/active': true }
        ]
      });
      
      // Result should reflect the updated state
      expect(result.results.length).toBe(3);
      
      // Verify the update was actually applied
      const activeUsers = store.query({
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      });
      expect(activeUsers.length).toBe(3);
    });
    
    test('should handle invalid query specifications', () => {
      // Test with invalid where clause
      expect(() => {
        store.queryWithUpdate({
          find: ['?e'],
          where: 'invalid', // Invalid where clause
          update: [
            { ':db/id': sampleData.users.charlie, ':user/active': true }
          ]
        });
      }).toThrow('Where clause must be an array');
    });
  });
  
  describe('Error Handling', () => {
    test('should validate update specification', () => {
      expect(() => {
        store.queryWithUpdate({
          find: ['?e'],
          where: [['?e', ':user/name', '?name']],
          update: 'invalid'
        });
      }).toThrow('Update must be an array');
      
      expect(() => {
        store.queryWithUpdate({
          find: ['?e'],
          where: [['?e', ':user/name', '?name']],
          update: [
            { ':user/name': 'Invalid' } // Missing :db/id
          ]
        });
      }).toThrow('Update must have :db/id');
    });
    
    test('should handle invalid entity ID types', () => {
      expect(() => {
        store.queryWithUpdate({
          find: ['?e'],
          where: [['?e', ':user/name', '?name']],
          update: [
            { ':db/id': {}, ':user/name': 'Invalid' } // Invalid ID type
          ]
        });
      }).toThrow('Invalid entity ID type');
    });
  });
});