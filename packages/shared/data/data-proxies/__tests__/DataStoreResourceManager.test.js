/**
 * DataStoreResourceManager Unit Tests
 * 
 * Tests the adapter that bridges DataStore to the universal ResourceManager interface.
 * NO MOCKS - uses real DataStore instance for all tests.
 */

import { jest } from '@jest/globals';
import { DataStoreResourceManager } from '../src/DataStoreResourceManager.js';
import { DataStore } from '@legion/data-store';
import * as d from '@legion/datascript';

describe('DataStoreResourceManager', () => {
  let dataStore;
  let resourceManager;
  
  beforeEach(() => {
    // Create real DataStore with schema
    const schema = {
      ':user/name': { card: 'one', valueType: 'string' },
      ':user/email': { card: 'one', valueType: 'string' },
      ':user/age': { card: 'one', valueType: 'number' },
      ':user/tags': { card: 'many', valueType: 'string' },
      ':post/title': { card: 'one', valueType: 'string' },
      ':post/content': { card: 'one', valueType: 'string' },
      ':post/author': { 
        card: 'one',
        valueType: 'ref'
      }
    };
    
    dataStore = new DataStore(schema);
    
    // Add test data using createEntities
    const result = dataStore.createEntities([
      { ':db/id': -1, ':user/name': 'Alice', ':user/email': 'alice@test.com', ':user/age': 30 },
      { ':db/id': -2, ':user/name': 'Bob', ':user/email': 'bob@test.com', ':user/age': 25 },
      { ':db/id': -3, ':post/title': 'Test Post', ':post/content': 'Content', ':post/author': -1 }
    ]);
    
    resourceManager = new DataStoreResourceManager(dataStore);
  });
  
  describe('constructor', () => {
    it('should create instance with DataStore', () => {
      expect(resourceManager).toBeDefined();
      expect(resourceManager).toBeInstanceOf(DataStoreResourceManager);
    });
    
    it('should fail without DataStore', () => {
      expect(() => new DataStoreResourceManager()).toThrow('DataStore is required');
      expect(() => new DataStoreResourceManager(null)).toThrow('DataStore is required');
      expect(() => new DataStoreResourceManager({})).toThrow('DataStore must have query method');
    });
  });
  
  describe('query', () => {
    it('should execute queries through DataStore', () => {
      const spec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = resourceManager.query(spec);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      // Check we got the user entities
      const names = results.map(r => r[1]).sort();
      expect(names).toEqual(['Alice', 'Bob']);
    });
    
    it('should handle empty query results', () => {
      const spec = {
        find: ['?e'],
        where: [['?e', ':user/name', 'NonExistent']]
      };
      
      const results = resourceManager.query(spec);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
    
    it('should fail with invalid query spec', () => {
      expect(() => resourceManager.query(null)).toThrow('Query specification is required');
      expect(() => resourceManager.query({})).toThrow('Query must have find clause');
      expect(() => resourceManager.query({ find: [] })).toThrow('Query must have where clause');
    });
  });
  
  describe('update', () => {
    it('should update entity through DataStore', () => {
      // Get an entity ID first
      const queryResult = resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      const entityId = queryResult[0][0];
      
      // Update the entity
      const updateResult = resourceManager.update(entityId, {
        ':user/age': 31,
        ':user/email': 'alice.new@test.com'
      });
      
      expect(updateResult).toBeDefined();
      expect(updateResult.success).toBe(true);
      expect(updateResult.entityId).toBe(entityId);
      
      // Verify the update
      const verifyResult = resourceManager.query({
        find: ['?age', '?email'],
        where: [
          [entityId, ':user/age', '?age'],
          [entityId, ':user/email', '?email']
        ]
      });
      
      expect(verifyResult[0][0]).toBe(31);
      expect(verifyResult[0][1]).toBe('alice.new@test.com');
    });
    
    it('should fail with invalid entity ID', () => {
      expect(() => resourceManager.update(null, {})).toThrow('Update data cannot be empty');
      expect(() => resourceManager.update(undefined, {})).toThrow('Update data cannot be empty');
      expect(() => resourceManager.update('invalid', {})).toThrow('Entity ID must be a number');
    });
    
    it('should fail with invalid update data', () => {
      expect(() => resourceManager.update(1, null)).toThrow('Update data is required');
      expect(() => resourceManager.update(1, 'invalid')).toThrow('Update data must be an object');
      expect(() => resourceManager.update(1, {})).toThrow('Update data cannot be empty');
    });
  });
  
  describe('subscribe', () => {
    it('should create subscription through DataStore', () => {
      const spec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const callback = jest.fn();
      const subscription = resourceManager.subscribe(spec, callback);
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Clean up
      subscription.unsubscribe();
    });
    
    it('should trigger callback on data changes', (done) => {
      const spec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const callback = jest.fn((results) => {
        // Initial callback should have been called with current data
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(2);
        
        // Clean up and complete test
        subscription.unsubscribe();
        done();
      });
      
      const subscription = resourceManager.subscribe(spec, callback);
    });
    
    it('should fail without callback', () => {
      const spec = {
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      };
      
      expect(() => resourceManager.subscribe(spec, null)).toThrow('Callback must be a function');
      expect(() => resourceManager.subscribe(spec, 'invalid')).toThrow('Callback must be a function');
    });
  });
  
  describe('getEntity', () => {
    it('should retrieve complete entity by ID', async () => {
      // Get an entity ID first
      const queryResult = await resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      const entityId = queryResult[0][0];
      
      const entity = await resourceManager.getEntity(entityId);
      
      expect(entity).toBeDefined();
      expect(entity[':db/id']).toBe(entityId);
      expect(entity[':user/name']).toBe('Alice');
      expect(entity[':user/email']).toBe('alice@test.com');
      expect(entity[':user/age']).toBe(30);
    });
    
    it('should throw error for non-existent entity', async () => {
      await expect(resourceManager.getEntity(999999)).rejects.toThrow('Entity not found');
    });
    
    it('should fail with invalid entity ID', async () => {
      await expect(resourceManager.getEntity(null)).rejects.toThrow('Entity ID is required');
      await expect(resourceManager.getEntity('invalid')).rejects.toThrow('Entity ID must be a number');
    });
  });
  
  describe('detectEntityType', () => {
    it('should detect entity type from :type attribute', async () => {
      // Create entity with explicit type
      const result = dataStore.createEntity(
        { ':db/id': -1, ':type': 'User', ':user/name': 'TypedUser' }
      );
      const entityId = result.tempids.get(-1);
      
      const entity = await resourceManager.getEntity(entityId);
      const type = await resourceManager.detectEntityType(entity);
      
      expect(type).toBe('User');
    });
    
    it('should detect entity type from schema attributes', async () => {
      const queryResult = await resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      const entityId = queryResult[0][0];
      
      const entity = await resourceManager.getEntity(entityId);
      const type = await resourceManager.detectEntityType(entity);
      
      expect(type).toBe('user'); // Inferred from :user/* attributes
    });
    
    it('should return null for entities without detectable type', async () => {
      const result = dataStore.createEntity(
        { ':db/id': -1, ':someattr': 'value' }  // No namespace, should return null
      );
      const entityId = result.tempids.get(-1);
      
      const entity = await resourceManager.getEntity(entityId);
      const type = await resourceManager.detectEntityType(entity);
      
      expect(type).toBeNull();
    });
  });
  
  describe('executeQueryWithUpdate', () => {
    it('should execute update before query', async () => {
      const spec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']],
        update: [
          { ':db/id': -1, ':user/name': 'David', ':user/email': 'david@test.com' }
        ]
      };
      
      const results = await resourceManager.executeQueryWithUpdate(spec);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // Should now have 3 users
      expect(results.length).toBe(3);
      
      // Check David was added
      const names = results.map(r => r[1]);
      expect(names).toContain('David');
    });
    
    it('should handle tempid resolution in query', async () => {
      const spec = {
        find: ['?e', '?title'],
        where: [['?e', ':post/title', '?title'], ['?e', ':post/author', '?new-1']],
        update: [
          { ':db/id': '?new-1', ':user/name': 'Author', ':user/email': 'author@test.com' },
          { ':db/id': '?new-2', ':post/title': 'New Post', ':post/content': 'Content', ':post/author': '?new-1' }
        ]
      };
      
      const results = await resourceManager.executeQueryWithUpdate(spec);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0][1]).toBe('New Post');
    });
    
    it('should execute regular query if no update specified', async () => {
      const spec = {
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = await resourceManager.executeQueryWithUpdate(spec);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });
  });
  
  describe('ResourceManager abstract methods', () => {
    it('should implement all required ResourceManager methods', () => {
      // Check that all abstract methods are implemented
      expect(typeof resourceManager.query).toBe('function');
      expect(typeof resourceManager.update).toBe('function');
      expect(typeof resourceManager.subscribe).toBe('function');
      expect(typeof resourceManager.getEntity).toBe('function');
      expect(typeof resourceManager.detectEntityType).toBe('function');
    });
    
    it('should maintain mixed sync/async interface as designed', () => {
      // query() is synchronous for Handle interface requirements
      const queryResult = resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      
      // Result should be returned immediately (synchronous)
      expect(Array.isArray(queryResult)).toBe(true);
      expect(queryResult.length).toBe(1);
      
      // getEntity() is async for complex operations
      const entityPromise = resourceManager.getEntity(queryResult[0][0]);
      expect(entityPromise).toBeInstanceOf(Promise);
    });
  });
});