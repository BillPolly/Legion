/**
 * Unit Tests for EntityProxy extending Handle from @legion/km-data-handle
 * 
 * Tests the new EntityProxy implementation that extends Handle instead of local CachedHandle
 * and uses DataStoreResourceManager for data access.
 */

import { EntityProxy } from '../src/EntityProxy.js';
import { Handle } from '@legion/data-handle';

// Import jest for spies and mocks
import { jest } from '@jest/globals';

// Mock ResourceManager for testing
class MockResourceManager {
  constructor() {
    this.entities = new Map();
    this.subscribers = [];
  }
  
  query(spec) {
    // Mock implementation for testing (SYNCHRONOUS for Handle interface)
    if (spec.where && spec.where.length > 0) {
      const clause = spec.where[0];
      if (clause.length === 3 && typeof clause[0] === 'number') {
        const [entityId, attr, valueVar] = clause;
        const entity = this.entities.get(entityId);
        if (!entity) return [];
        
        if (attr === '?attr') {
          // Return all attributes for entity
          return Object.entries(entity)
            .filter(([key]) => key !== ':db/id')
            .map(([key, value]) => [key, value]);
        } else if (typeof attr === 'string' && attr.startsWith(':')) {
          // Return specific attribute value
          const value = entity[attr];
          return value !== undefined ? [[value]] : [];
        }
      }
    }
    
    // Aggregate query mock
    if (spec.findType === 'scalar' && Array.isArray(spec.find[0])) {
      const [aggFunc, variable] = spec.find[0];
      if (aggFunc === 'count') {
        return this.entities.size;
      }
    }
    
    return [];
  }
  
  update(entityId, data) {
    const entity = this.entities.get(entityId) || { ':db/id': entityId };
    Object.assign(entity, data);
    this.entities.set(entityId, entity);
    
    // Notify subscribers asynchronously (callbacks are async)
    setImmediate(() => {
      this.subscribers.forEach(sub => {
        try { sub.callback(entity); } catch (e) {}
      });
    });
    
    return { entityId, tempids: {}, dbAfter: {} };
  }
  
  subscribe(spec, callback) {
    const subscription = { id: Date.now(), spec, callback };
    this.subscribers.push(subscription);
    return {
      id: subscription.id,
      unsubscribe: () => {
        const index = this.subscribers.indexOf(subscription);
        if (index > -1) this.subscribers.splice(index, 1);
      }
    };
  }
  
  async getEntity(entityId) {
    const results = await this.query({
      find: ['?attr', '?value'],
      where: [[entityId, '?attr', '?value']]
    });
    
    // If no results, return empty object (which will be handled by EntityProxy)
    if (results.length === 0) {
      return {};
    }
    
    const entity = { ':db/id': entityId };
    results.forEach(([attr, value]) => {
      entity[attr] = value;
    });
    
    return entity;
  }
  
  async detectEntityType(entity) {
    if (entity[':type']) {
      return entity[':type'];
    }
    return 'Entity';
  }
  
  getSchema() {
    return {
      version: '1.0.0',
      type: 'mock',
      attributes: {},
      constraints: {}
    };
  }
  
  // Test helper methods
  setEntity(entityId, data) {
    this.entities.set(entityId, { ':db/id': entityId, ...data });
  }
}

describe('EntityProxy extending Handle', () => {
  let mockResourceManager;
  let entityProxy;
  const testEntityId = 123;
  
  beforeEach(() => {
    mockResourceManager = new MockResourceManager();
    entityProxy = new EntityProxy(mockResourceManager, testEntityId, {
      cacheTTL: 1000
    });
  });
  
  afterEach(() => {
    if (entityProxy && !entityProxy.isDestroyed()) {
      entityProxy.destroy();
    }
  });
  
  describe('Constructor', () => {
    test('should extend Handle', () => {
      expect(entityProxy).toBeInstanceOf(Handle);
    });
    
    test('should initialize with resourceManager and entityId', () => {
      expect(entityProxy.resourceManager).toBe(mockResourceManager);
      expect(entityProxy.entityId).toBe(testEntityId);
    });
    
    test('should set correct handle type', () => {
      expect(entityProxy.handleType).toBe('EntityProxy');
    });
    
    test('should throw error for invalid entity ID', () => {
      expect(() => {
        new EntityProxy(mockResourceManager, null);
      }).toThrow('Entity ID is required');
      
      expect(() => {
        new EntityProxy(mockResourceManager, 'invalid');
      }).toThrow('Entity ID must be a number');
    });
    
    test('should throw error for missing resourceManager', () => {
      expect(() => {
        new EntityProxy(null, testEntityId);
      }).toThrow('ResourceManager must be a non-null object');
    });
  });
  
  describe('Handle Integration', () => {
    test('should have Actor capabilities from Handle', () => {
      expect(typeof entityProxy.receive).toBe('function');
      expect(typeof entityProxy.call).toBe('function');
      expect(typeof entityProxy.query).toBe('function');
    });
    
    test('should have Handle lifecycle capabilities', () => {
      expect(typeof entityProxy.subscribe).toBe('function');
      expect(typeof entityProxy.destroy).toBe('function');
      expect(typeof entityProxy.isDestroyed).toBe('function');
    });
    
    test('should have introspection capabilities', () => {
      expect(typeof entityProxy.getIntrospectionInfo).toBe('function');
    });
    
    test('should be an instance of Actor', () => {
      expect(entityProxy.isActor).toBe(true);
    });
  });
  
  describe('Entity-specific Methods', () => {
    beforeEach(() => {
      // Setup test entity data
      mockResourceManager.setEntity(testEntityId, {
        ':name': 'Test User',
        ':email': 'test@example.com',
        ':age': 30,
        ':type': 'User'
      });
    });
    
    describe('value()', () => {
      test('should return complete entity data', () => {
        const entity = entityProxy.value();
        
        expect(entity).toEqual({
          ':db/id': 123,
          ':name': 'Test User',
          ':email': 'test@example.com',
          ':age': 30,
          ':type': 'User'
        });
      });
      
      test('should use cached value on second call', () => {
        const spy = jest.spyOn(mockResourceManager, 'query');
        
        // First call should fetch from resource manager
        const entity1 = entityProxy.value();
        expect(spy).toHaveBeenCalled();
        
        // Second call should use cache (if caching is enabled)
        const entity2 = entityProxy.value();
        expect(entity1).toEqual(entity2);
        
        spy.mockRestore();
      });
      
      test('should throw error if entity not found', () => {
        const nonExistentProxy = new EntityProxy(mockResourceManager, 999);
        
        expect(() => nonExistentProxy.value()).toThrow('Entity not found');
        
        nonExistentProxy.destroy();
      });
    });
    
    describe('get()', () => {
      test('should return specific attribute value', () => {
        const name = entityProxy.get(':name');
        expect(name).toBe('Test User');
        
        const email = entityProxy.get(':email');
        expect(email).toBe('test@example.com');
      });
      
      test('should return undefined for non-existent attribute', () => {
        const value = entityProxy.get(':nonexistent');
        expect(value).toBeUndefined();
      });
      
      test('should validate attribute name format', () => {
        expect(() => entityProxy.get('invalid')).toThrow('Attribute name must start with \':\'');
        expect(() => entityProxy.get(null)).toThrow('Attribute name is required');
      });
    });
    
    describe('set()', () => {
      test('should update single attribute', () => {
        const result = entityProxy.set(':name', 'Updated Name');
        
        expect(result.success).toBe(true);
        expect(result.entityId).toBe(testEntityId);
        
        // Verify the update
        const updatedName = entityProxy.get(':name');
        expect(updatedName).toBe('Updated Name');
      });
      
      test('should validate attribute name format', () => {
        expect(() => entityProxy.set('invalid', 'value')).toThrow('Attribute name must start with \':\'');
        expect(() => entityProxy.set(null, 'value')).toThrow('Attribute name is required');
      });
      
      test('should validate value is not undefined', () => {
        expect(() => entityProxy.set(':name', undefined)).toThrow('Attribute value is required');
      });
    });
    
    describe('update()', () => {
      test('should update multiple attributes', () => {
        const updateData = {
          ':name': 'New Name',
          ':age': 31,
          ':status': 'active'
        };
        
        const result = entityProxy.update(updateData);
        
        expect(result.success).toBe(true);
        expect(result.entityId).toBe(testEntityId);
        
        // Verify all updates
        const updatedEntity = entityProxy.value();
        expect(updatedEntity[':name']).toBe('New Name');
        expect(updatedEntity[':age']).toBe(31);
        expect(updatedEntity[':status']).toBe('active');
      });
      
      test('should invalidate cache after update', () => {
        // Prime the cache
        entityProxy.value();
        const spy = jest.spyOn(mockResourceManager, 'query');
        
        // Update should invalidate cache
        entityProxy.update({ ':name': 'Updated' });
        
        // Next value() call should fetch fresh data if cache invalidated
        entityProxy.value();
        expect(spy).toHaveBeenCalled();
        
        spy.mockRestore();
      });
      
      test('should validate update data format', () => {
        expect(() => entityProxy.update(null)).toThrow('Update data is required');
        expect(() => entityProxy.update({})).toThrow('Update data cannot be empty');
        expect(() => entityProxy.update({ invalid: 'value' })).toThrow('Attributes must start with \':\'');
      });
    });
  });
  
  describe('Actor System Integration', () => {
    beforeEach(() => {
      mockResourceManager.setEntity(testEntityId, {
        ':name': 'Test User',
        ':email': 'test@example.com'
      });
    });
    
    test('should handle get message via Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'get',
        args: [':name']
      });
      
      expect(result).toBe('Test User');
    });
    
    test('should handle set message via Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'set',
        args: [':name', 'New Name']
      });
      
      expect(result.success).toBe(true);
      
      // Verify the update
      const updatedName = entityProxy.get(':name');
      expect(updatedName).toBe('New Name');
    });
    
    test('should handle update message via Actor system', async () => {
      const updateData = { ':status': 'active' };
      const result = await entityProxy.receive('call-method', {
        method: 'update',
        args: [updateData]
      });
      
      expect(result.success).toBe(true);
    });
    
    test('should handle value message via Actor system', async () => {
      const result = await entityProxy.receive('call-method', {
        method: 'value',
        args: []
      });
      
      expect(result[':name']).toBe('Test User');
      expect(result[':email']).toBe('test@example.com');
    });
    
    test('should serialize for remote transmission', () => {
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
  
  describe('Error Handling', () => {
    test('should handle resource manager errors gracefully', () => {
      const errorResourceManager = {
        query() {
          throw new Error('Query failed');
        },
        update() {
          throw new Error('Update failed');
        },
        subscribe() {
          return { id: 'test', unsubscribe: () => {} };
        },
        getSchema() {
          return { version: '1.0.0' };
        }
      };
      
      const errorProxy = new EntityProxy(errorResourceManager, testEntityId);
      
      expect(() => errorProxy.value()).toThrow('Query failed');
      expect(() => errorProxy.get(':name')).toThrow('Query failed');
      expect(() => errorProxy.update({ ':name': 'test' })).toThrow('Update failed');
      
      errorProxy.destroy();
    });
    
    test('should throw error when used after destruction', () => {
      entityProxy.destroy();
      
      expect(() => entityProxy.value()).toThrow('Handle has been destroyed');
      expect(() => entityProxy.get(':name')).toThrow('Handle has been destroyed');
      expect(() => entityProxy.update({ ':name': 'test' })).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Cleanup and Destruction', () => {
    beforeEach(() => {
      // Setup test entity data for this describe block
      mockResourceManager.setEntity(testEntityId, {
        ':name': 'Test User',
        ':email': 'test@example.com'
      });
    });
    
    test('should clean up resources on destroy', () => {
      // Subscribe to something to create resources
      const callback = jest.fn();
      const subscription = entityProxy.subscribe({ find: ['?attr'], where: [['?e', '?attr', '?value']] }, callback);
      
      // Set some cached values
      entityProxy.value();
      
      // Destroy should clean up everything
      entityProxy.destroy();
      
      expect(entityProxy.isDestroyed()).toBe(true);
    });
    
    test('should be safe to call destroy multiple times', () => {
      entityProxy.destroy();
      entityProxy.destroy(); // Should not throw
      
      expect(entityProxy.isDestroyed()).toBe(true);
    });
  });
});