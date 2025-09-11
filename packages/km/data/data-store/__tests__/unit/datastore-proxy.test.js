/**
 * DataStoreProxy Unit Tests
 * Phase 3, Step 3.1: DataStoreProxy Wrapper Implementation
 * 
 * Unit tests for DataStoreProxy class that wraps DataStore to provide
 * proxy-returning query methods while maintaining separation of concerns.
 * 
 * Tests follow TDD approach - write tests first, implement after.
 * No mocks - use real DataStore instances for proper validation.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DataStoreProxy } from '../../src/datastore-proxy.js';
import { DataStore } from '../../src/store.js';
import { StreamProxy } from '../../src/stream-proxy.js';
import { EntityProxy } from '../../src/proxy.js';
import { CollectionProxy } from '../../src/collection-proxy.js';
import { QueryTypeDetector } from '../../src/query-type-detector.js';
import { PropertyTypeDetector } from '../../src/property-type-detector.js';

describe('DataStoreProxy Unit Tests', () => {
  let store;
  let proxyStore;
  let schema;
  
  beforeEach(() => {
    // Test schema
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':post/title': { valueType: 'string' },
      ':post/author': { valueType: 'ref' }
    };
    
    store = new DataStore(schema);
    proxyStore = new DataStoreProxy(store);
    
    // Add test data
    store.createEntities([
      { ':user/id': 'u1', ':user/name': 'Alice', ':user/age': 30 },
      { ':user/id': 'u2', ':user/name': 'Bob', ':user/age': 25 },
      { ':user/id': 'u3', ':user/name': 'Charlie', ':user/age': 35 }
    ]);
  });

  describe('Constructor and Initialization', () => {
    test('should create DataStoreProxy with DataStore instance', () => {
      expect(proxyStore).toBeDefined();
      expect(proxyStore.dataStore).toBe(store);
    });
    
    test('should throw error when dataStore is null or undefined', () => {
      expect(() => new DataStoreProxy(null)).toThrow('DataStore instance is required');
      expect(() => new DataStoreProxy(undefined)).toThrow('DataStore instance is required');
    });
    
    test('should throw error when dataStore is not a DataStore instance', () => {
      expect(() => new DataStoreProxy({})).toThrow('Invalid DataStore instance');
      expect(() => new DataStoreProxy('invalid')).toThrow('Invalid DataStore instance');
      expect(() => new DataStoreProxy(123)).toThrow('Invalid DataStore instance');
    });
    
    test('should initialize QueryTypeDetector with DataStore', () => {
      expect(proxyStore.queryTypeDetector).toBeDefined();
      expect(proxyStore.queryTypeDetector).toBeInstanceOf(QueryTypeDetector);
      expect(proxyStore.queryTypeDetector.store).toBe(store);
    });
    
    test('should initialize PropertyTypeDetector with schema', () => {
      expect(proxyStore.propertyTypeDetector).toBeDefined();
      expect(proxyStore.propertyTypeDetector).toBeInstanceOf(PropertyTypeDetector);
      expect(proxyStore.propertyTypeDetector.schema).toEqual(schema);
    });
  });

  describe('query() Method - Proxy Returns', () => {
    test('should return StreamProxy for scalar queries with single result', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/id', 'u1']]
      };
      
      const result = proxyStore.query(querySpec);
      
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toBe('Alice'); // Single scalar result unwrapped
    });
    
    test('should return CollectionProxy for scalar queries with multiple results', () => {
      const querySpec = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const result = proxyStore.query(querySpec);
      
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.value()).toEqual([['Alice'], ['Bob'], ['Charlie']]);
    });
    
    test('should return EntityProxy for single entity queries', () => {
      const querySpec = {
        find: ['?e'],
        where: [['?e', ':user/id', 'u1']]
      };
      
      const result = proxyStore.query(querySpec);
      
      expect(result).toBeInstanceOf(EntityProxy);
      expect(result.get(':user/name')).toBe('Alice');
    });
    
    test('should return CollectionProxy for multiple entity queries', () => {
      const querySpec = {
        find: ['?e'],
        where: [['?e', ':user/age', '?age']]
      };
      
      const result = proxyStore.query(querySpec);
      
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.length).toBe(3);
    });
    
    test('should return StreamProxy for aggregate queries', () => {
      const querySpec = {
        find: [['count']],
        where: [['?e', ':user/name', '?name']]
      };
      
      const result = proxyStore.query(querySpec);
      
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toBe(3);
    });
    
    test('should return CollectionProxy for multi-variable queries', () => {
      const querySpec = {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      };
      
      const result = proxyStore.query(querySpec);
      
      expect(result).toBeInstanceOf(CollectionProxy);
      expect(result.value()).toEqual([
        ['Alice', 30],
        ['Bob', 25],
        ['Charlie', 35]
      ]);
    });
    
    test('should handle empty results appropriately', () => {
      // Empty scalar query -> StreamProxy
      const scalarQuery = {
        find: ['?name'],
        where: [['?e', ':user/id', 'nonexistent']]
      };
      
      const scalarResult = proxyStore.query(scalarQuery);
      expect(scalarResult).toBeInstanceOf(StreamProxy);
      expect(scalarResult.value()).toEqual([]);
      
      // Empty entity query -> EntityProxy (represents absence)
      const entityQuery = {
        find: ['?e'],
        where: [['?e', ':user/id', 'nonexistent']]
      };
      
      const entityResult = proxyStore.query(entityQuery);
      expect(entityResult).toBeInstanceOf(EntityProxy);
      
      // Empty multi-variable query -> CollectionProxy
      const multiQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/id', 'nonexistent']]
      };
      
      const multiResult = proxyStore.query(multiQuery);
      expect(multiResult).toBeInstanceOf(CollectionProxy);
      expect(multiResult.value()).toEqual([]);
    });
    
    test('should throw error for invalid query spec', () => {
      expect(() => proxyStore.query(null)).toThrow('Query spec is required');
      expect(() => proxyStore.query(undefined)).toThrow('Query spec is required');
      expect(() => proxyStore.query({})).toThrow('Query spec must have find clause');
      expect(() => proxyStore.query({ find: [] })).toThrow('Find clause cannot be empty');
      expect(() => proxyStore.query({ find: ['?e'] })).toThrow('Query spec must have where clause');
    });
  });

  describe('Pass-through Methods', () => {
    test('should pass through createEntity() to DataStore', () => {
      const entityData = { ':user/id': 'u4', ':user/name': 'Diana', ':user/age': 28 };
      
      const result = proxyStore.createEntity(entityData);
      
      expect(result).toBeDefined();
      expect(result.entityId).toBeDefined();
      expect(result.dbAfter).toBeDefined();
      
      // Verify entity was created in underlying DataStore
      const query = store.query({
        find: ['?name'],
        where: [['?e', ':user/id', 'u4'], ['?e', ':user/name', '?name']]
      });
      expect(query).toEqual([['Diana']]);
    });
    
    test('should pass through createEntities() to DataStore', () => {
      const entitiesData = [
        { ':user/id': 'u5', ':user/name': 'Eve', ':user/age': 32 },
        { ':user/id': 'u6', ':user/name': 'Frank', ':user/age': 29 }
      ];
      
      const result = proxyStore.createEntities(entitiesData);
      
      expect(result).toBeDefined();
      expect(result.entityIds).toHaveLength(2);
      expect(result.dbAfter).toBeDefined();
      
      // Verify entities were created in underlying DataStore
      const query = store.query({
        find: ['?name'],
        where: [['?e', ':user/id', 'u5'], ['?e', ':user/name', '?name']]
      });
      expect(query).toEqual([['Eve']]);
    });
    
    test('should pass through db() to DataStore', () => {
      const db1 = proxyStore.db();
      const db2 = store.db();
      
      expect(db1).toBe(db2);
      expect(db1).toBeDefined();
    });
    
    test('should pass through errors from DataStore methods', () => {
      // Test invalid entity data
      expect(() => proxyStore.createEntity(null)).toThrow('Entity data is required');
      expect(() => proxyStore.createEntity({})).toThrow('Entity data cannot be empty');
      
      // Test invalid entities array
      expect(() => proxyStore.createEntities(null)).toThrow('Entities data must be a non-empty array');
      expect(() => proxyStore.createEntities([])).toThrow('Entities data must be a non-empty array');
    });
  });

  describe('getProxy() Method', () => {
    test('should return EntityProxy for existing entity ID', () => {
      const entities = store.createEntities([
        { ':user/id': 'u7', ':user/name': 'Grace' }
      ]);
      const entityId = entities.entityIds[0];
      
      const proxy = proxyStore.getProxy(entityId);
      
      expect(proxy).toBeInstanceOf(EntityProxy);
      expect(proxy.entityId).toBe(entityId);
      expect(proxy.get(':user/name')).toBe('Grace');
    });
    
    test('should return new EntityProxy for non-existent entity ID', () => {
      const proxy = proxyStore.getProxy(99999);
      
      expect(proxy).toBeInstanceOf(EntityProxy);
      expect(proxy.entityId).toBe(99999);
      expect(proxy.isValid()).toBe(false);
    });
    
    test('should return singleton EntityProxy for same entity ID', () => {
      const entities = store.createEntities([
        { ':user/id': 'u8', ':user/name': 'Henry' }
      ]);
      const entityId = entities.entityIds[0];
      
      const proxy1 = proxyStore.getProxy(entityId);
      const proxy2 = proxyStore.getProxy(entityId);
      
      expect(proxy1).toBe(proxy2); // Same instance
    });
    
    test('should throw error for invalid entity ID', () => {
      expect(() => proxyStore.getProxy(null)).toThrow('Entity ID is required');
      expect(() => proxyStore.getProxy(undefined)).toThrow('Entity ID is required');
      expect(() => proxyStore.getProxy('invalid')).toThrow('Entity ID must be a number');
    });
  });

  describe('Factory Methods', () => {
    describe('createStreamProxy()', () => {
      test('should create StreamProxy with given value', () => {
        const value = 'test value';
        const proxy = proxyStore.createStreamProxy(value);
        
        expect(proxy).toBeInstanceOf(StreamProxy);
        expect(proxy.value()).toBe(value);
      });
      
      test('should create StreamProxy with value and query spec', () => {
        const value = 42;
        const querySpec = { find: ['?x'], where: [] };
        const proxy = proxyStore.createStreamProxy(value, querySpec);
        
        expect(proxy).toBeInstanceOf(StreamProxy);
        expect(proxy.value()).toBe(value);
        expect(proxy.querySpec).toBe(querySpec);
      });
      
      test('should handle array values', () => {
        const arrayValue = [1, 2, 3];
        const proxy = proxyStore.createStreamProxy(arrayValue);
        
        expect(proxy).toBeInstanceOf(StreamProxy);
        expect(proxy.value()).toEqual(arrayValue);
      });
      
      test('should handle null and undefined values', () => {
        const nullProxy = proxyStore.createStreamProxy(null);
        const undefinedProxy = proxyStore.createStreamProxy(undefined);
        
        expect(nullProxy).toBeInstanceOf(StreamProxy);
        expect(undefinedProxy).toBeInstanceOf(StreamProxy);
        expect(nullProxy.value()).toBe(null);
        expect(undefinedProxy.value()).toBe(undefined);
      });
    });
    
    describe('createEntityProxy()', () => {
      test('should create EntityProxy for existing entity', () => {
        const entities = store.createEntities([
          { ':user/id': 'factory-test', ':user/name': 'Factory User' }
        ]);
        const entityId = entities.entityIds[0];
        
        const proxy = proxyStore.createEntityProxy(entityId);
        
        expect(proxy).toBeInstanceOf(EntityProxy);
        expect(proxy.entityId).toBe(entityId);
        expect(proxy.get(':user/name')).toBe('Factory User');
      });
      
      test('should use singleton pattern (same as getProxy)', () => {
        const entities = store.createEntities([
          { ':user/id': 'singleton-test', ':user/name': 'Singleton User' }
        ]);
        const entityId = entities.entityIds[0];
        
        const proxy1 = proxyStore.createEntityProxy(entityId);
        const proxy2 = proxyStore.getProxy(entityId);
        const proxy3 = proxyStore.createEntityProxy(entityId);
        
        // All should be the same instance
        expect(proxy1).toBe(proxy2);
        expect(proxy2).toBe(proxy3);
      });
      
      test('should handle non-existent entity IDs', () => {
        const proxy = proxyStore.createEntityProxy(88888);
        
        expect(proxy).toBeInstanceOf(EntityProxy);
        expect(proxy.entityId).toBe(88888);
        expect(proxy.isValid()).toBe(false);
      });
    });
    
    describe('createCollectionProxy()', () => {
      test('should create CollectionProxy with given items', () => {
        const items = [['Alice'], ['Bob'], ['Charlie']];
        const proxy = proxyStore.createCollectionProxy(items);
        
        expect(proxy).toBeInstanceOf(CollectionProxy);
        expect(proxy.value()).toEqual(items);
        expect(proxy.length).toBe(3);
      });
      
      test('should create CollectionProxy with items and query spec', () => {
        const items = [[1], [2], [3]];
        const querySpec = { find: ['?e'], where: [['?e', ':user/age', '?age']] };
        const proxy = proxyStore.createCollectionProxy(items, querySpec);
        
        expect(proxy).toBeInstanceOf(CollectionProxy);
        expect(proxy.value()).toEqual(items);
        expect(proxy.querySpec).toStrictEqual(querySpec);
      });
      
      test('should handle empty collections', () => {
        const proxy = proxyStore.createCollectionProxy([]);
        
        expect(proxy).toBeInstanceOf(CollectionProxy);
        expect(proxy.value()).toEqual([]);
        expect(proxy.length).toBe(0);
      });
      
      test('should handle nested array structures', () => {
        const items = [
          ['Alice', 30],
          ['Bob', 25],
          ['Charlie', 35]
        ];
        const proxy = proxyStore.createCollectionProxy(items);
        
        expect(proxy).toBeInstanceOf(CollectionProxy);
        expect(proxy.value()).toEqual(items);
        expect(proxy.length).toBe(3);
      });
    });
    
    describe('Factory methods integration', () => {
      test('should create all proxy types and use them together', () => {
        // Create test data
        const entities = store.createEntities([
          { ':user/id': 'integration-user', ':user/name': 'Integration User', ':user/age': 33 }
        ]);
        const entityId = entities.entityIds[0];
        
        // Create different proxy types
        const streamProxy = proxyStore.createStreamProxy('test-value');
        const entityProxy = proxyStore.createEntityProxy(entityId);
        const collectionProxy = proxyStore.createCollectionProxy([[entityId], [999]]);
        
        // Verify types
        expect(streamProxy).toBeInstanceOf(StreamProxy);
        expect(entityProxy).toBeInstanceOf(EntityProxy);
        expect(collectionProxy).toBeInstanceOf(CollectionProxy);
        
        // Verify functionality
        expect(streamProxy.value()).toBe('test-value');
        expect(entityProxy.get(':user/name')).toBe('Integration User');
        expect(collectionProxy.length).toBe(2);
      });
    });
  });

  describe('_createProxy() Private Method', () => {
    test('should create StreamProxy for StreamProxy type', () => {
      const querySpec = { find: ['?name'], where: [] };
      const results = [['test']];
      
      const proxy = proxyStore._createProxy('StreamProxy', querySpec, results);
      
      expect(proxy).toBeInstanceOf(StreamProxy);
      // StreamProxy extracts the value from results
      expect(proxy.value()).toBe('test'); // [['test']] -> 'test'
    });
    
    test('should create EntityProxy for EntityProxy type', () => {
      const entities = store.createEntities([
        { ':user/id': 'u9', ':user/name': 'Iris' }
      ]);
      const entityId = entities.entityIds[0];
      const querySpec = { find: ['?e'], where: [] };
      const results = [[entityId]];
      
      const proxy = proxyStore._createProxy('EntityProxy', querySpec, results);
      
      expect(proxy).toBeInstanceOf(EntityProxy);
      expect(proxy.entityId).toBe(entityId);
    });
    
    test('should create CollectionProxy for CollectionProxy type', () => {
      const querySpec = { find: ['?name'], where: [] };
      const results = [['Alice'], ['Bob']];
      
      const proxy = proxyStore._createProxy('CollectionProxy', querySpec, results);
      
      expect(proxy).toBeInstanceOf(CollectionProxy);
      // CollectionProxy stores the results array
      expect(proxy.value()).toEqual(results);
      expect(proxy.length).toBe(2);
    });
    
    test('should throw error for unknown proxy type', () => {
      const querySpec = { find: ['?name'], where: [] };
      const results = [];
      
      expect(() => proxyStore._createProxy('UnknownProxy', querySpec, results))
        .toThrow('Unknown proxy type: UnknownProxy');
    });
    
    test('should handle empty results for EntityProxy', () => {
      const querySpec = { find: ['?e'], where: [] };
      const results = [];
      
      const proxy = proxyStore._createProxy('EntityProxy', querySpec, results);
      
      expect(proxy).toBeInstanceOf(EntityProxy);
      expect(proxy.entityId).toBe(-1); // Sentinel value for empty results
      expect(proxy._isEmpty).toBe(true); // Special marker for empty query
      expect(proxy.isValid()).toBe(false);
    });
  });

  describe('Query Composition', () => {
    test('should support chaining queries on proxy results', () => {
      // First query: get all users
      const allUsers = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(allUsers).toBeInstanceOf(CollectionProxy);
      expect(allUsers.length).toBe(3);
      
      // When we query from a CollectionProxy, it returns EntityProxy objects
      const userProxies = allUsers.query({
        find: ['?e'],
        where: [['?e', ':user/age', '?age']]
      });
      
      // Filter EntityProxy objects by age > 25
      const olderUsers = userProxies.filter(proxy => {
        // proxy is an EntityProxy
        if (proxy instanceof EntityProxy) {
          const age = proxy.get(':user/age');
          return age > 25;
        }
        return false;
      });
      
      expect(olderUsers.length).toBe(2); // Alice (30) and Charlie (35)
    });
    
    test('should maintain proxy type through query chains', () => {
      // Start with entity query
      const userQuery = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/id', 'u1']]
      });
      
      expect(userQuery).toBeInstanceOf(EntityProxy);
      
      // Query from entity
      const nameQuery = userQuery.query({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      });
      
      expect(nameQuery).toBeInstanceOf(StreamProxy);
      // StreamProxy.value() for single result returns the unwrapped value
      expect(nameQuery.value()).toBe('Alice');
    });
  });

  describe('Error Handling', () => {
    test('should provide clear error messages for query failures', () => {
      const invalidQuery = {
        find: ['?unknown'],
        where: [['?e', ':invalid/attribute', '?unknown']]
      };
      
      // Should not throw, but return empty result with appropriate proxy
      const result = proxyStore.query(invalidQuery);
      expect(result).toBeInstanceOf(StreamProxy);
      expect(result.value()).toEqual([]);
    });
    
    test('should handle schema validation errors gracefully', () => {
      // Query with malformed where clause
      const malformedQuery = {
        find: ['?e'],
        where: [['invalid']] // Missing attribute and value
      };
      
      // DataScript will throw on malformed queries, which is expected behavior
      // We should catch and handle these errors appropriately
      expect(() => proxyStore.query(malformedQuery)).toThrow('Unsupported clause shape');
    });
  });
});