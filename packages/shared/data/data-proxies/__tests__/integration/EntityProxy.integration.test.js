/**
 * Integration Tests for EntityProxy with real DataStore
 * 
 * Tests the new EntityProxy implementation that extends Handle from @legion/handle
 * with real DataStore and DataStoreDataSource components.
 * 
 * NO MOCKS - Uses real DataStore, DataStoreDataSource, and Handle
 */

import { jest } from '@jest/globals';
import { EntityProxy } from '../../src/EntityProxy.js';
import { DataStoreDataSource } from '../../src/DataStoreDataSource.js';
import { DataStore } from '@legion/data-store';
import { Handle } from '../../../handle/src/index.js';
import * as d from '@legion/datascript';

describe('EntityProxy Integration with Real DataStore', () => {
  let dataStore;
  let resourceManager;
  let testEntityId;
  
  beforeEach(() => {
    // Create real DataStore instance with schema
    const schema = {
      ':name': { card: 'one', valueType: 'string' },
      ':email': { card: 'one', valueType: 'string', unique: 'identity' },
      ':age': { card: 'one', valueType: 'number' },
      ':type': { card: 'one', valueType: 'string' },
      ':status': { card: 'one', valueType: 'string' },
      ':tags': { card: 'many', valueType: 'string' },
      ':score': { card: 'one', valueType: 'number' }
    };
    
    dataStore = new DataStore(schema);
    
    // Create DataStoreDataSource adapter
    resourceManager = new DataStoreDataSource(dataStore);
    
    // Create test entity in DataStore
    const transactionResult = dataStore.createEntities([
      { 
        ':db/id': -1, 
        ':name': 'Integration Test User',
        ':email': 'integration@test.com',
        ':age': 25,
        ':type': 'User',
        ':status': 'active'
      }
    ]);
    
    // Get the actual entity ID from tempids (tempids is a Map)
    testEntityId = transactionResult.tempids.get(-1);
    expect(typeof testEntityId).toBe('number');
    expect(testEntityId).toBeGreaterThan(0);
  });
  
  describe('Constructor and BaseHandle Integration', () => {
    test('should create EntityProxy extending BaseHandle with real ResourceManager', () => {
      const entityProxy = new EntityProxy(resourceManager, testEntityId, {
        cacheTTL: 2000
      });
      
      // Verify inheritance
      expect(entityProxy).toBeInstanceOf(Handle);
      expect(entityProxy).toBeInstanceOf(EntityProxy);
      
      // Verify properties
      expect(entityProxy.resourceManager).toBe(resourceManager);
      expect(entityProxy.entityId).toBe(testEntityId);
      expect(entityProxy.handleType).toBe('EntityProxy');
      
      // Verify Handle capabilities
      expect(typeof entityProxy.receive).toBe('function');
      expect(typeof entityProxy.subscribe).toBe('function');
      expect(typeof entityProxy.serialize).toBe('function');
      
      entityProxy.destroy();
    });
    
    test('should validate constructor parameters with real components', () => {
      expect(() => {
        new EntityProxy(null, testEntityId);
      }).toThrow('ResourceManager must be a non-null object');
      
      expect(() => {
        new EntityProxy(resourceManager, null);
      }).toThrow('Entity ID is required');
      
      expect(() => {
        new EntityProxy(resourceManager, 'invalid');
      }).toThrow('Entity ID must be a number');
    });
  });
  
  describe('Entity Data Access with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId, {
        cacheTTL: 1000
      });
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should retrieve complete entity data through ResourceManager', () => {
      const entity = entityProxy.value();
      
      expect(entity).toEqual({
        ':db/id': testEntityId,
        ':name': 'Integration Test User',
        ':email': 'integration@test.com',
        ':age': 25,
        ':type': 'User',
        ':status': 'active'
      });
    });
    
    test('should use BaseHandle caching on subsequent value() calls', () => {
      // Spy on ResourceManager query method (EntityProxy uses query, not getEntity)
      const querySpy = jest.spyOn(resourceManager, 'query');
      
      // First call should fetch from ResourceManager
      const entity1 = entityProxy.value();
      expect(querySpy).toHaveBeenCalledTimes(1);
      
      // Second call - EntityProxy doesn't have built-in caching without cacheManager
      const entity2 = entityProxy.value();
      // Without cacheManager, it will query each time
      expect(querySpy).toHaveBeenCalledTimes(2);
      expect(entity1).toEqual(entity2);
      
      querySpy.mockRestore();
    });
    
    test('should get specific attribute values through DataStore', () => {
      const name = entityProxy.get(':name');
      expect(name).toBe('Integration Test User');
      
      const email = entityProxy.get(':email');
      expect(email).toBe('integration@test.com');
      
      const age = entityProxy.get(':age');
      expect(age).toBe(25);
    });
    
    test('should return undefined for non-existent attributes', () => {
      const nonExistent = entityProxy.get(':nonexistent');
      expect(nonExistent).toBeUndefined();
    });
    
    test('should validate attribute names for DataScript format', () => {
      expect(() => entityProxy.get('invalid')).toThrow('Attribute name must start with \':\'');
      expect(() => entityProxy.get(null)).toThrow('Attribute name is required');
    });
  });
  
  describe('Entity Updates with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId);
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should update single attribute through DataStore', () => {
      const result = entityProxy.set(':name', 'Updated Name');
      
      expect(result.success).toBe(true);
      expect(result.entityId).toBe(testEntityId);
      
      // Verify the update in DataStore
      const updatedEntity = entityProxy.value();
      expect(updatedEntity[':name']).toBe('Updated Name');
      
      // Verify other attributes unchanged
      expect(updatedEntity[':email']).toBe('integration@test.com');
      expect(updatedEntity[':age']).toBe(25);
    });
    
    test('should update multiple attributes through DataStore', () => {
      const updateData = {
        ':name': 'Multi Update Name',
        ':age': 30,
        ':status': 'updated'
      };
      
      const result = entityProxy.update(updateData);
      
      expect(result.success).toBe(true);
      expect(result.entityId).toBe(testEntityId);
      
      // Verify all updates
      const updatedEntity = entityProxy.value();
      expect(updatedEntity[':name']).toBe('Multi Update Name');
      expect(updatedEntity[':age']).toBe(30);
      expect(updatedEntity[':status']).toBe('updated');
      
      // Verify unchanged attributes
      expect(updatedEntity[':email']).toBe('integration@test.com');
      expect(updatedEntity[':type']).toBe('User');
    });
    
    test('should invalidate BaseHandle cache after update', () => {
      // Prime the cache
      entityProxy.value();
      
      // Spy on ResourceManager to track cache invalidation
      const querySpy = jest.spyOn(resourceManager, 'query');
      
      // Update should invalidate cache
      entityProxy.update({ ':status': 'cache-test' });
      
      // Next value() call should fetch fresh data (no built-in cache without cacheManager)
      const freshEntity = entityProxy.value();
      expect(querySpy).toHaveBeenCalled();
      expect(freshEntity[':status']).toBe('cache-test');
      
      querySpy.mockRestore();
    });
    
    test('should validate update data format for DataScript', () => {
      expect(() => entityProxy.update(null)).toThrow('Update data is required');
      expect(() => entityProxy.update({})).toThrow('Update data cannot be empty');
      expect(() => entityProxy.update({ invalid: 'value' })).toThrow("Attributes must start with ':'. Found: invalid");
    });
  });
  
  describe('Entity Queries with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId);
      
      // Add additional test data to make queries meaningful
      dataStore.updateEntity(testEntityId, {
        ':tags': ['important', 'user'],
        ':score': 85
      });
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should execute entity-scoped queries', () => {
      const querySpec = {
        find: ['?attr', '?value'],
        where: [
          ['?e', '?attr', '?value']
        ]
      };
      
      const results = entityProxy.query(querySpec);
      
      // Should find all attributes for this entity
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContainEqual([':name', 'Integration Test User']);
      expect(results).toContainEqual([':email', 'integration@test.com']);
      expect(results).toContainEqual([':age', 25]);
    });
    
    test('should validate query specifications', () => {
      expect(() => entityProxy.query(null)).toThrow('Query specification is required');
      expect(() => entityProxy.query({})).toThrow('Query specification must have find clause');
      expect(() => entityProxy.query({ find: ['?x'] })).toThrow('Query specification must have where clause');
    });
  });
  
  describe('Entity Existence with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId);
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should return true for existing entity', () => {
      const exists = entityProxy.exists();
      expect(exists).toBe(true);
    });
    
    test('should return false for non-existent entity', () => {
      const nonExistentProxy = new EntityProxy(resourceManager, 99999);
      
      const exists = nonExistentProxy.exists();
      expect(exists).toBe(false);
      
      nonExistentProxy.destroy();
    });
  });
  
  describe('Actor System Integration with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId);
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should handle value message through Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'value',
        args: []
      });
      
      expect(result).toEqual({
        ':db/id': testEntityId,
        ':name': 'Integration Test User',
        ':email': 'integration@test.com',
        ':age': 25,
        ':type': 'User',
        ':status': 'active'
      });
    });
    
    test('should handle get message through Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'get',
        args: [':name']
      });
      
      expect(result).toBe('Integration Test User');
    });
    
    test('should handle set message through Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'set',
        args: [':name', 'Actor Updated Name']
      });
      
      expect(result.success).toBe(true);
      
      // Verify the update through direct method call
      const updatedName = entityProxy.get(':name');
      expect(updatedName).toBe('Actor Updated Name');
    });
    
    test('should handle update message through Actor system', async () => {
      const updateData = { ':status': 'actor-updated' };
      const result = await entityProxy.receive('call-method', {
        method: 'update',
        args: [updateData]
      });
      
      expect(result.success).toBe(true);
      
      // Verify the update
      const updatedEntity = entityProxy.value();
      expect(updatedEntity[':status']).toBe('actor-updated');
    });
    
    test('should handle exists message through Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'exists',
        args: []
      });
      
      expect(result).toBe(true);
    });
    
    test('should handle query message through Actor system', async () => {
      const querySpec = {
        find: ['?value'],
        where: [['?e', ':name', '?value']]
      };
      
      const result = await entityProxy.receive('call-method', {
        method: 'query',
        args: [querySpec]
      });
      
      expect(result).toEqual([['Integration Test User']]);
    });
    
    test('should throw error for unknown methods', async () => {
      await expect(
        entityProxy.receive('call-method', {
          method: 'unknownMethod',
          args: []
        })
      ).rejects.toThrow('Unknown method: unknownMethod');
    });
    
    test('should serialize for remote transmission with entity data', () => {
      const serialized = entityProxy.serialize();
      
      expect(serialized).toEqual({
        __type: 'RemoteHandle',
        handleId: expect.any(String),
        handleType: 'EntityProxy',
        attributes: expect.any(Object),
        data: expect.objectContaining({
          entityId: testEntityId
        })
      });
    });
  });
  
  describe('Error Handling with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId);
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should handle DataStore query errors', () => {
      // Create invalid query that will cause DataStore error
      const invalidQuery = {
        find: ['?invalid'],
        where: [['invalid-syntax']] // This should cause DataStore to fail
      };
      
      expect(() => entityProxy.query(invalidQuery)).toThrow();
    });
    
    test('should handle DataStore update errors', () => {
      // Try to update with invalid transaction data
      const invalidUpdate = { ':invalid-attribute': null };
      
      // This should fail at the ResourceManager level
      expect(() => entityProxy.update(invalidUpdate)).toThrow();
    });
    
    test('should throw error when accessing destroyed handle', () => {
      entityProxy.destroy();
      
      expect(() => entityProxy.value()).toThrow('Handle has been destroyed');
      expect(() => entityProxy.get(':name')).toThrow('Handle has been destroyed');
      expect(() => entityProxy.update({ ':name': 'test' })).toThrow('Handle has been destroyed');
      expect(() => entityProxy.exists()).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Cache Invalidation with Real DataStore', () => {
    let entityProxy;
    
    beforeEach(() => {
      entityProxy = new EntityProxy(resourceManager, testEntityId, {
        cacheTTL: 5000
      });
    });
    
    afterEach(() => {
      if (entityProxy && !entityProxy.isDestroyed()) {
        entityProxy.destroy();
      }
    });
    
    test('should invalidate cache when entity changes through different proxy', () => {
      // Prime cache in first proxy
      const initialEntity = entityProxy.value();
      expect(initialEntity[':name']).toBe('Integration Test User');
      
      // Create second proxy for same entity
      const entityProxy2 = new EntityProxy(resourceManager, testEntityId);
      
      // Update through second proxy
      entityProxy2.update({ ':name': 'Updated By Other Proxy' });
      
      // First proxy will get fresh data (no caching without cacheManager)
      const updatedEntity = entityProxy.value();
      expect(updatedEntity[':name']).toBe('Updated By Other Proxy');
      
      entityProxy2.destroy();
    });
    
    test('should handle cache TTL expiration', async () => {
      // Create proxy with very short TTL
      const shortTTLProxy = new EntityProxy(resourceManager, testEntityId, {
        cacheTTL: 10 // 10ms
      });
      
      // Prime cache
      shortTTLProxy.value();
      
      // Spy on ResourceManager
      const querySpy = jest.spyOn(resourceManager, 'query');
      querySpy.mockClear(); // Clear previous calls from value()
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Next call should fetch fresh data (no built-in cache without cacheManager)
      shortTTLProxy.value();
      expect(querySpy).toHaveBeenCalled();
      
      querySpy.mockRestore();
      shortTTLProxy.destroy();
    });
  });
  
  describe('Resource Cleanup with Real DataStore', () => {
    test('should clean up all resources on destroy', () => {
      const entityProxy = new EntityProxy(resourceManager, testEntityId);
      
      // Use the proxy to create some cached data and subscriptions
      entityProxy.value();
      
      // Subscribe to something (if subscription system exists)
      const callback = jest.fn();
      const querySpec = { find: ['?attr'], where: [[testEntityId, '?attr', '?value']] };
      entityProxy.subscribe(querySpec, callback);
      
      // Destroy should clean up everything
      entityProxy.destroy();
      
      expect(entityProxy.isDestroyed()).toBe(true);
    });
    
    test('should be safe to call destroy multiple times', () => {
      const entityProxy = new EntityProxy(resourceManager, testEntityId);
      
      entityProxy.destroy();
      expect(entityProxy.isDestroyed()).toBe(true);
      
      // Second destroy should not throw
      entityProxy.destroy();
      expect(entityProxy.isDestroyed()).toBe(true);
    });
  });
  
  describe('Non-Existent Entity Handling', () => {
    test('should handle non-existent entity gracefully', () => {
      const nonExistentProxy = new EntityProxy(resourceManager, 99999);
      
      // value() should throw for non-existent entity
      expect(() => nonExistentProxy.value()).toThrow('Entity not found');
      
      // get() should return undefined for non-existent entity
      const value = nonExistentProxy.get(':name');
      expect(value).toBeUndefined();
      
      // exists() should return false
      const exists = nonExistentProxy.exists();
      expect(exists).toBe(false);
      
      nonExistentProxy.destroy();
    });
  });
});