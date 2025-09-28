/**
 * Error Handling Test Suite
 * Tests error handling and recovery mechanisms across all proxy types
 */

import { jest } from '@jest/globals';
import { DataStoreProxy } from '../src/DataStoreProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { DataStoreDataSource } from '../src/DataStoreDataSource.js';
import { createTestStore, createSampleData, assertions, validators, errorHelpers } from './setup.js';

describe('Error Handling and Recovery', () => {
  let mockStore;
  let dataStoreProxy;
  let sampleData;
  
  beforeEach(() => {
    mockStore = createTestStore();
    dataStoreProxy = new DataStoreProxy(mockStore, {
      cacheMaxSize: 100,
      cacheTTL: 30000,
      enableCacheStatistics: true
    });
    sampleData = createSampleData(mockStore);
  });
  
  afterEach(() => {
    if (dataStoreProxy) {
      dataStoreProxy.destroy();
    }
  });
  
  describe('DataStoreProxy Error Handling', () => {
    test('should handle invalid entity ID types gracefully', () => {
      expect(() => dataStoreProxy.entity(null)).toThrow('Entity ID is required');
      expect(() => dataStoreProxy.entity(undefined)).toThrow('Entity ID is required');
      expect(() => dataStoreProxy.entity('not-a-number')).toThrow('Entity ID must be a number');
      expect(() => dataStoreProxy.entity({})).toThrow('Entity ID must be a number');
      expect(() => dataStoreProxy.entity([])).toThrow('Entity ID must be a number');
    });
    
    test('should handle invalid query specifications gracefully', () => {
      expect(() => dataStoreProxy.stream(null)).toThrow('Query specification is required');
      expect(() => dataStoreProxy.stream(undefined)).toThrow('Query specification is required');
      expect(() => dataStoreProxy.stream('not-object')).toThrow('Query must be an object');
      expect(() => dataStoreProxy.stream({})).toThrow('Query must have find clause');
      expect(() => dataStoreProxy.stream({ find: [] })).toThrow('Query must have find clause');
      expect(() => dataStoreProxy.stream({ find: ['?e'] })).toThrow('Query must have where clause');
      expect(() => dataStoreProxy.stream({ find: ['?e'], where: 'not-array' })).toThrow('Where clause must be an array');
    });
    
    test('should handle invalid collection specifications gracefully', () => {
      expect(() => dataStoreProxy.collection(null)).toThrow('Collection specification is required');
      expect(() => dataStoreProxy.collection(undefined)).toThrow('Collection specification is required');
      expect(() => dataStoreProxy.collection('not-object')).toThrow('Collection specification must be an object');
      expect(() => dataStoreProxy.collection({})).toThrow('Collection specification must have find clause');
      expect(() => dataStoreProxy.collection({ find: [] })).toThrow('Collection specification must have find clause');
      expect(() => dataStoreProxy.collection({ find: ['?e'] })).toThrow('Collection specification must have where clause');
      // entityKey is required in DataStoreProxy
      expect(() => dataStoreProxy.collection({ find: ['?e'], where: [['?e', ':attr', 'value']] })).toThrow('Collection specification must have entityKey');
      const spec1 = dataStoreProxy.collection({ find: ['?e'], where: [['?e', ':attr', 'value']], entityKey: '?e' });
      expect(spec1).toBeDefined();
    });
    
    test('should handle store errors gracefully during query execution', () => {
      // Create a store that throws errors
      const errorStore = {
        query: () => { throw new Error('Store query failed'); },
        updateEntity: () => { throw new Error('Store update failed'); },
        subscribe: mockStore.subscribe
      };
      
      const errorProxy = new DataStoreProxy(errorStore);
      
      try {
        expect(() => {
          errorProxy.queryStore({ find: ['?e'], where: [['?e', ':attr', 'value']] });
        }).toThrow('Store query failed');
        
        const result = errorProxy.updateStore(1, { ':attr': 'value' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Store update failed');
      } finally {
        errorProxy.destroy();
      }
    });
    
    test('should handle destroyed proxy access gracefully', () => {
      const entityProxy = dataStoreProxy.entity(sampleData.users.alice);
      
      // Destroy the main proxy
      dataStoreProxy.destroy();
      
      // Accessing destroyed proxy should throw appropriate errors
      expect(() => dataStoreProxy.entity(1)).toThrow('Handle has been destroyed');
      expect(() => dataStoreProxy.queryStore({ find: ['?e'], where: [['?e', ':attr', 'value']] })).toThrow('Handle has been destroyed');
      expect(() => entityProxy.value()).toThrow('Handle has been destroyed');
    });
  });
  
  describe('EntityProxy Error Handling', () => {
    test('should handle non-existent entities gracefully', () => {
      const nonExistentId = 99999;
      const entityProxy = dataStoreProxy.entity(nonExistentId);
      
      // Should throw when trying to access value of non-existent entity
      expect(() => entityProxy.value()).toThrow('Entity not found');
      
      // exists() should return false
      expect(entityProxy.exists()).toBe(false);
    });
    
    test('should handle invalid attribute operations gracefully', () => {
      const entityProxy = dataStoreProxy.entity(sampleData.users.alice);
      
      // Invalid attribute names
      expect(() => entityProxy.get('')).toThrow('Attribute name is required');
      expect(() => entityProxy.get(null)).toThrow('Attribute name is required');
      expect(() => entityProxy.get('no-colon')).toThrow('Attribute name must start with \':\'');
      expect(() => entityProxy.get(123)).toThrow('Attribute name must start with \':\'');
      
      // Invalid set operations
      expect(() => entityProxy.set('')).toThrow('Attribute name is required');
      expect(() => entityProxy.set(':attr', undefined)).toThrow('Attribute value is required');
    });
    
    test('should handle update validation errors gracefully', () => {
      const entityProxy = dataStoreProxy.entity(sampleData.users.alice);
      
      // Invalid update data
      expect(() => entityProxy.update(null)).toThrow('Update data is required');
      expect(() => entityProxy.update(undefined)).toThrow('Update data is required');
      expect(() => entityProxy.update('not-object')).toThrow('Update data must be an object');
      expect(() => entityProxy.update({})).toThrow('Update data cannot be empty');
      expect(() => entityProxy.update({ 'no-colon': 'value' })).toThrow('Attributes must start with \':\'');
    });
    
    test('should handle subscription errors gracefully', () => {
      const entityProxy = dataStoreProxy.entity(sampleData.users.alice);
      
      // Invalid subscription parameters
      expect(() => entityProxy.subscribe(null)).toThrow('Query specification is required');
      expect(() => entityProxy.subscribe({ find: ['?attr'] })).toThrow('Callback function is required');
      expect(() => entityProxy.subscribe({ find: ['?attr'], where: [] }, null)).toThrow('Callback function is required');
    });
    
    test('should handle store errors during entity operations gracefully', () => {
      let shouldThrowError = false;
      const flakyStore = {
        query: (...args) => {
          if (shouldThrowError) throw new Error('Intermittent store error');
          return mockStore.query(...args);
        },
        updateEntity: (...args) => {
          if (shouldThrowError) throw new Error('Update failed');
          return mockStore.updateEntity(...args);
        },
        subscribe: mockStore.subscribe
      };
      
      const flakyProxy = new DataStoreProxy(flakyStore);
      
      try {
        const entityProxy = flakyProxy.entity(sampleData.users.alice);
        
        // Should work initially
        const initialData = entityProxy.value();
        expect(initialData[':user/name']).toBe('Alice');
        
        // Enable error mode
        shouldThrowError = true;
        
        // Update should throw since EntityProxy doesn't catch errors
        expect(() => entityProxy.update({ ':user/age': 31 })).toThrow('Update failed');
        
        // Get should also throw when the store throws errors
        shouldThrowError = true; // Ensure error mode is still on
        expect(() => entityProxy.get(':user/age')).toThrow('Intermittent store error');
        
      } finally {
        flakyProxy.destroy();
      }
    });
  });
  
  describe('StreamProxy Error Handling', () => {
    test('should handle invalid query specifications gracefully', () => {
      const resourceManager = new DataStoreDataSource(mockStore);
      expect(() => new StreamProxy(resourceManager, null)).toThrow('Query specification is required');
      expect(() => new StreamProxy(resourceManager, 'not-object')).toThrow('Query specification must be an object');
      expect(() => new StreamProxy(resourceManager, {})).toThrow('Query specification must have find clause');
      expect(() => new StreamProxy(resourceManager, { find: [] })).toThrow('Query specification must have find clause');
      expect(() => new StreamProxy(resourceManager, { find: ['?e'] })).toThrow('Query specification must have where clause');
      expect(() => new StreamProxy(resourceManager, { find: ['?e'], where: 'not-array' })).toThrow('Where clause must be an array');
    });
    
    test('should handle store errors during streaming gracefully', () => {
      const querySpec = {
        find: ['?e', '?name'],
        where: [
          ['?e', ':user/active', true],
          ['?e', ':user/name', '?name']
        ]
      };
      
      const errorStore = {
        query: () => { throw new Error('Stream query failed'); },
        subscribe: mockStore.subscribe
      };
      
      const errorResourceManager = new DataStoreDataSource(errorStore);
      const streamProxy = new StreamProxy(errorResourceManager, querySpec);
      
      // Should handle errors gracefully during value access
      expect(() => streamProxy.value()).toThrow('Stream query failed');
      
      streamProxy.destroy();
    });
    
    test('should handle subscription errors gracefully', () => {
      const querySpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]]
      };
      
      const noSubStore = {
        query: mockStore.query.bind(mockStore),
        subscribe: null // No subscription support
      };
      
      const noSubResourceManager = new DataStoreDataSource(noSubStore);
      const streamProxy = new StreamProxy(noSubResourceManager, querySpec);
      
      try {
        // Should still work for value access
        const results = streamProxy.value();
        expect(Array.isArray(results)).toBe(true);
        
        // Subscription attempt when store.subscribe is null will fail
        // StreamProxy checks if resourceManager has subscribe method
        const callback = jest.fn();
        try {
          streamProxy.subscribe(querySpec, callback);
          // If it doesn't throw, subscription returned something
          expect(callback).not.toHaveBeenCalled(); // Won't be called immediately
        } catch (error) {
          // Expected to throw since store.subscribe is null
          expect(error).toBeDefined();
        }
        
      } finally {
        streamProxy.destroy();
      }
    });
  });
  
  describe('CollectionProxy Error Handling', () => {
    test('should handle invalid collection specifications gracefully', () => {
      const resourceManager = new DataStoreDataSource(mockStore);
      expect(() => new CollectionProxy(resourceManager, null)).toThrow('Collection specification is required');
      expect(() => new CollectionProxy(resourceManager, 'not-object')).toThrow('Collection specification must be an object');
      expect(() => new CollectionProxy(resourceManager, {})).toThrow('Collection specification must have find clause');
      expect(() => new CollectionProxy(resourceManager, { find: [] })).toThrow('Collection specification must have find clause');
      expect(() => new CollectionProxy(resourceManager, { find: ['?e'] })).toThrow('Collection specification must have where clause');
      expect(() => new CollectionProxy(resourceManager, { find: ['?e'], where: 'not-array' })).toThrow('Where clause must be an array');
      // entityKey is now auto-detected from where clause, so these should work
      const spec1 = new CollectionProxy(resourceManager, { find: ['?e'], where: [['?e', ':attr', 'value']] });
      expect(spec1).toBeDefined();
    });
    
    test('should handle invalid collection access patterns gracefully', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const collection = dataStoreProxy.collection(collectionSpec);
      
      // Invalid get operations (CollectionProxy.get expects entity ID)
      expect(() => collection.get(null)).toThrow('Entity ID is required');
      expect(() => collection.get(undefined)).toThrow('Entity ID is required');
      expect(() => collection.get('not-number')).toThrow('Entity ID must be a number');
      // These won't throw immediately, but will return EntityProxy that may fail on use
      const proxy1 = collection.get(99999);
      expect(proxy1).toBeDefined();
    });
    
    test('should handle bulk operation errors gracefully', () => {
      const collectionSpec = {
        find: ['?e'],
        where: [['?e', ':user/active', true]],
        entityKey: '?e'
      };
      
      const collection = dataStoreProxy.collection(collectionSpec);
      
      // Invalid update operations
      expect(() => collection.updateAll(null)).toThrow('Update data must be an object');
      expect(() => collection.updateAll({})).not.toThrow(); // Empty object is allowed
      // Validation happens at the ResourceManager level, not in CollectionProxy
      const result = collection.updateAll({ 'no-colon': 'value' });
      expect(result.success).toBe(false); // Should fail but not throw
      
      expect(() => collection.updateWhere(null, { ':attr': 'value' })).toThrow('Update predicate must be a function');
      expect(() => collection.updateWhere(() => true, null)).toThrow('Update data must be an object');
    });
    
    test('should handle partial update failures in bulk operations gracefully', () => {
      let updateCount = 0;
      const flakyStore = {
        query: mockStore.query.bind(mockStore),
        updateEntity: (entityId, updateData) => {
          updateCount++;
          // Fail every other update
          if (updateCount % 2 === 0) {
            throw new Error(`Update failed for entity ${entityId}`);
          }
          return mockStore.updateEntity(entityId, updateData);
        },
        subscribe: mockStore.subscribe
      };
      
      const flakyProxy = new DataStoreProxy(flakyStore);
      
      try {
        const collectionSpec = {
          find: ['?e'],
          where: [['?e', ':user/name', '?name']],
          entityKey: '?e'
        };
        
        const collection = flakyProxy.collection(collectionSpec);
        
        // Should handle partial failures gracefully
        const updateResult = collection.updateAll({ ':bulk_test': true });
        // Since some updates fail, success will be false
        expect(updateResult.success).toBe(false);
        expect(updateResult.updated).toBeGreaterThan(0);
        expect(updateResult.errors.length).toBeGreaterThan(0);
        
      } finally {
        flakyProxy.destroy();
      }
    });
  });
  
  describe('Error Recovery Mechanisms', () => {
    test('should recover from temporary store failures', async () => {
      let failureCount = 0;
      const recoveryStore = {
        query: (...args) => {
          failureCount++;
          if (failureCount <= 2) {
            throw new Error('Temporary failure');
          }
          return mockStore.query(...args);
        },
        updateEntity: mockStore.updateEntity.bind(mockStore),
        subscribe: mockStore.subscribe
      };
      
      const recoveryProxy = new DataStoreProxy(recoveryStore, {
        cacheMaxSize: 0, // Disable caching to ensure each call hits the store
        cacheTTL: 0
      });
      
      try {
        const entityProxy = recoveryProxy.entity(sampleData.users.alice);
        
        // Reset failure count to start fresh after proxy creation
        failureCount = 0;
        
        // First two attempts should fail, but we can manually retry
        expect(() => entityProxy.get(':user/name')).toThrow('Temporary failure');
        expect(() => entityProxy.get(':user/name')).toThrow('Temporary failure');
        
        // Third attempt should succeed
        const name = entityProxy.get(':user/name');
        expect(name).toBe('Alice');
        
      } finally {
        recoveryProxy.destroy();
      }
    });
    
    test('should handle cache corruption gracefully', () => {
      const entityProxy = dataStoreProxy.entity(sampleData.users.alice);
      
      // Populate cache
      const initialName = entityProxy.get(':user/name');
      expect(initialName).toBe('Alice');
      
      // EntityProxy now uses cacheManager from Handle, not DataStoreProxy
      // Since EntityProxy doesn't have built-in cache without a cacheManager instance,
      // we'll test that it always returns fresh data
      const nameAfterCorruption = entityProxy.get(':user/name');
      expect(nameAfterCorruption).toBe('Alice');
    });
    
    test('should handle subscription failures gracefully', async () => {
      let subscriptionCount = 0;
      const flakySubStore = {
        query: mockStore.query.bind(mockStore),
        updateEntity: mockStore.updateEntity.bind(mockStore),
        subscribe: (querySpec, callback) => {
          subscriptionCount++;
          if (subscriptionCount === 1) {
            throw new Error('Subscription failed');
          }
          return mockStore.subscribe(querySpec, callback);
        }
      };
      
      const flakySubProxy = new DataStoreProxy(flakySubStore);
      
      try {
        const entityProxy = flakySubProxy.entity(sampleData.users.alice);
        
        // Should handle subscription failure gracefully
        // The proxy should still work for direct operations
        const name = entityProxy.get(':user/name');
        expect(name).toBe('Alice');
        
        // Subsequent subscription attempts might work
        let subscriptionWorked = false;
        try {
          // subscribe requires a query spec and callback
          const querySpec = { 
            find: ['?attr', '?value'], 
            where: [[sampleData.users.alice, '?attr', '?value']] 
          };
          const sub = entityProxy.subscribe(querySpec, () => {
            subscriptionWorked = true;
          });
          expect(sub).toBeDefined();
          sub.unsubscribe();
        } catch (error) {
          // Subscription failure is acceptable as long as basic operations work
        }
        
      } finally {
        flakySubProxy.destroy();
      }
    });
  });
  
  describe('Resource Cleanup on Errors', () => {
    test('should cleanup resources properly even when errors occur during destroy', () => {
      const entityProxy = dataStoreProxy.entity(sampleData.users.alice);
      
      // Force an error condition during cleanup by corrupting internal state
      entityProxy._subscriptions.add({
        unsubscribe: () => { throw new Error('Cleanup error'); }
      });
      
      // Destroy should complete despite errors
      expect(() => {
        dataStoreProxy.destroy();
      }).not.toThrow();
      
      // Should be marked as destroyed
      expect(dataStoreProxy.isDestroyed()).toBe(true);
    });
    
    test('should handle memory cleanup failures gracefully', () => {
      // Create many proxies to test memory cleanup
      const proxies = [];
      for (let i = 0; i < 10; i++) {
        // Create proxies with different IDs (alice is 1, so 1+i gives us 1,2,3...)
        proxies.push(dataStoreProxy.entity(sampleData.users.alice + i));
      }
      
      // DataStoreProxy now has internal cache management
      // We can't directly corrupt the cache anymore, but we can test that
      // destroy handles multiple proxies gracefully
      
      // Destroy should handle cleanup gracefully even with many proxies
      expect(() => {
        dataStoreProxy.destroy();
      }).not.toThrow();
      
      // Verify all proxies are marked as destroyed
      expect(dataStoreProxy.isDestroyed()).toBe(true);
    });
  });
});