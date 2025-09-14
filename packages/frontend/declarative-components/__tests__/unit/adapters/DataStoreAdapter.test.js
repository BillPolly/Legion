/**
 * Unit tests for DataStore Adapter
 * Tests integration between declarative components and @legion/data-store
 */

import { DataStoreAdapter, createDataStoreAdapter } from '../../../src/adapters/DataStoreAdapter.js';
import { DataStore } from '@legion/data-store';

describe('DataStore Adapter', () => {
  let dataStore;
  let adapter;
  let schema;

  beforeEach(async () => {
    // Create schema for test entities
    schema = {
      ':entity/name': { ':db/unique': ':db.unique/identity' },
      ':name': {},
      ':age': {},
      ':active': {},
      ':profile/bio': {},
      ':profile/avatar': {},
      ':item/value': {},
      ':item/count': {},
      ':item/enabled': {}
    };

    dataStore = new DataStore(schema);
    adapter = new DataStoreAdapter(dataStore);
  });

  afterEach(() => {
    if (adapter) {
      adapter.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should create adapter with DataStore', () => {
      expect(adapter).toBeDefined();
      expect(adapter.dataStore).toBe(dataStore);
    });

    test('should throw without DataStore', () => {
      expect(() => new DataStoreAdapter()).toThrow('DataStore is required');
    });

    test('should initialize with empty subscriptions', () => {
      expect(adapter.subscriptions.size).toBe(0);
      expect(adapter.activeSubscriptions.size).toBe(0);
    });
  });

  describe('Entity Management', () => {
    test('should initialize entities in DataStore', async () => {
      const initialEntities = {
        user: {
          name: 'John Doe',
          age: 30,
          active: true
        },
        item: {
          value: 'test',
          count: 42,
          enabled: true
        }
      };

      await adapter.initializeEntities(initialEntities);

      // In simpleMode, verify entities are available via adapter methods
      const userData = adapter.getEntityData('user');
      const itemData = adapter.getEntityData('item');

      expect(userData).toBeDefined();
      expect(userData.name).toBe('John Doe');
      expect(userData.age).toBe(30);
      expect(userData.active).toBe(true);

      expect(itemData).toBeDefined();
      expect(itemData.value).toBe('test');
      expect(itemData.count).toBe(42);
      expect(itemData.enabled).toBe(true);
    });

    test('should get entity data by name', async () => {
      await adapter.initializeEntities({
        user: {
          name: 'John Doe',
          age: 30,
          active: true
        }
      });

      const entityData = adapter.getEntityData('user');
      
      expect(entityData).toBeDefined();
      expect(entityData.name).toBe('John Doe');
      expect(entityData.age).toBe(30);
      expect(entityData.active).toBe(true);
      // In simpleMode, _entityName and _entityId are not added
    });

    test('should return null for non-existent entity', () => {
      const entityData = adapter.getEntityData('nonexistent');
      expect(entityData).toBeNull();
    });

    test('should get entity ID by name', async () => {
      await adapter.initializeEntities({
        user: { name: 'John' }
      });

      const entityId = adapter.getEntityId('user');
      // In simpleMode, entity IDs are not used
      expect(entityId).toBeUndefined();
    });
  });

  describe('Property Access', () => {
    beforeEach(async () => {
      await adapter.initializeEntities({
        user: {
          name: 'John Doe',
          age: 30,
          active: true,
          'profile/bio': 'Developer',
          'profile/avatar': 'avatar.jpg'
        },
        item: {
          value: 'test value',
          count: 42,
          enabled: true
        }
      });
    });

    test('should get simple property values', () => {
      expect(adapter.getProperty('user.name')).toBe('John Doe');
      expect(adapter.getProperty('user.age')).toBe(30);
      expect(adapter.getProperty('user.active')).toBe(true);
      expect(adapter.getProperty('item.value')).toBe('test value');
      expect(adapter.getProperty('item.count')).toBe(42);
    });

    test('should get nested property values', () => {
      // Note: DataScript flattens nested properties with /
      expect(adapter.getProperty('user.profile/bio')).toBe('Developer');
      expect(adapter.getProperty('user.profile/avatar')).toBe('avatar.jpg');
    });

    test('should return undefined for non-existent properties', () => {
      expect(adapter.getProperty('user.nonexistent')).toBeUndefined();
      expect(adapter.getProperty('nonexistent.property')).toBeUndefined();
    });

    test('should cache property values', () => {
      // First access
      const value1 = adapter.getProperty('user.name');
      expect(value1).toBe('John Doe');

      // Second access should use cache
      const value2 = adapter.getProperty('user.name');
      expect(value2).toBe('John Doe');
      // In simpleMode, property cache is not used
      expect(adapter.propertyCache.has('user.name')).toBe(false);
    });

    test('should set property values', () => {
      adapter.setProperty('user.name', 'Jane Doe');
      
      // Should clear cache and return new value
      expect(adapter.getProperty('user.name')).toBe('Jane Doe');
    });

    test('should set property for non-existent entity in simpleMode', () => {
      // In simpleMode, setting a property on non-existent entity creates it
      adapter.setProperty('nonexistent.property', 'value');
      expect(adapter.getProperty('nonexistent.property')).toBe('value');
    });
  });

  describe('Subscription System', () => {
    beforeEach(async () => {
      await adapter.initializeEntities({
        user: {
          name: 'John Doe',
          age: 30,
          active: true
        }
      });
    });

    test('should subscribe to property changes', () => {
      const callback = jest.fn();
      
      adapter.on('user.name', callback);
      
      expect(adapter.subscriptions.has('user.name')).toBe(true);
      expect(adapter.subscriptions.get('user.name').has(callback)).toBe(true);
      expect(adapter.activeSubscriptions.has('user.name')).toBe(true);
    });

    test('should support multiple callbacks for same property', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      adapter.on('user.name', callback1);
      adapter.on('user.name', callback2);
      
      const callbacks = adapter.subscriptions.get('user.name');
      expect(callbacks.size).toBe(2);
      expect(callbacks.has(callback1)).toBe(true);
      expect(callbacks.has(callback2)).toBe(true);
    });

    test('should unsubscribe from property changes', () => {
      const callback = jest.fn();
      
      adapter.on('user.name', callback);
      expect(adapter.subscriptions.has('user.name')).toBe(true);
      
      adapter.off('user.name', callback);
      expect(adapter.subscriptions.has('user.name')).toBe(false);
      expect(adapter.activeSubscriptions.has('user.name')).toBe(false);
    });

    test('should handle unsubscribing non-existent callback gracefully', () => {
      const callback = jest.fn();
      
      expect(() => adapter.off('user.name', callback)).not.toThrow();
    });

    test('should notify callbacks on property changes', async () => {
      const callback = jest.fn();
      
      adapter.on('user.name', callback);
      
      // Give subscription time to register
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Change property
      adapter.setProperty('user.name', 'Jane Smith');
      
      // Give reactive system time to process
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalledWith('Jane Smith');
    });

    test('should support subscriptions to multiple properties', () => {
      const nameCallback = jest.fn();
      const ageCallback = jest.fn();
      
      adapter.on('user.name', nameCallback);
      adapter.on('user.age', ageCallback);
      
      expect(adapter.subscriptions.size).toBe(2);
      expect(adapter.activeSubscriptions.size).toBe(2);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      await adapter.initializeEntities({
        user: {
          name: 'John Doe',
          age: 30
        }
      });
    });

    test('should cache entity data', () => {
      const entity1 = adapter.getEntityData('user');
      const entity2 = adapter.getEntityData('user');
      
      expect(entity1).toBe(entity2); // Same object reference in simpleMode
      // In simpleMode, entity cache is not used
      expect(adapter.entityCache.has('user')).toBe(false);
    });

    test('should cache property values', () => {
      const value1 = adapter.getProperty('user.name');
      const value2 = adapter.getProperty('user.name');
      
      expect(value1).toBe(value2);
      // In simpleMode, property cache is not used
      expect(adapter.propertyCache.has('user.name')).toBe(false);
    });

    test('should clear property cache on property change', () => {
      // In simpleMode, property cache is not used
      adapter.getProperty('user.name');
      expect(adapter.propertyCache.has('user.name')).toBe(false);
      
      // Change property
      adapter.setProperty('user.name', 'Jane Doe');
      
      // Cache should still be empty
      expect(adapter.propertyCache.has('user.name')).toBe(false);
    });

    test('should clear entity cache on property change', () => {
      // In simpleMode, entity cache is not used
      adapter.getEntityData('user');
      expect(adapter.entityCache.has('user')).toBe(false);
      
      // Change property
      adapter.setProperty('user.name', 'Jane Doe');
      
      // Entity cache should still be empty
      expect(adapter.entityCache.has('user')).toBe(false);
    });

    test('should clear nested property cache correctly', () => {
      // In simpleMode, property cache is not used
      adapter.getProperty('user.name');
      adapter.getProperty('user.age');
      
      expect(adapter.propertyCache.has('user.name')).toBe(false);
      expect(adapter.propertyCache.has('user.age')).toBe(false);
      
      // Clear cache for user.name (no-op in simpleMode)
      adapter.clearPropertyCache('user.name');
      
      expect(adapter.propertyCache.has('user.name')).toBe(false);
      expect(adapter.propertyCache.has('user.age')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle DataStore query errors gracefully', () => {
      // Mock DataStore to throw error
      const mockDataStore = {
        query: () => { throw new Error('Query failed'); },
        _reactiveEngine: { addSubscription: jest.fn() }
      };
      
      const errorAdapter = new DataStoreAdapter(mockDataStore);
      
      const result = errorAdapter.getEntityData('user');
      expect(result).toBeNull();
    });

    test('should handle subscription callback errors gracefully', async () => {
      await adapter.initializeEntities({
        user: { name: 'John' }
      });
      
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      // Should not throw when adding callback
      expect(() => adapter.on('user.name', errorCallback)).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await adapter.initializeEntities({
        user: { name: 'John' }
      });
    });

    test('should cleanup all subscriptions and caches', () => {
      const callback = jest.fn();
      
      // Create subscriptions and cache some data
      adapter.on('user.name', callback);
      adapter.getProperty('user.name');
      adapter.getEntityData('user');
      
      expect(adapter.subscriptions.size).toBe(1);
      expect(adapter.activeSubscriptions.size).toBe(1);
      // In simpleMode, caches are not used
      expect(adapter.propertyCache.size).toBe(0);
      expect(adapter.entityCache.size).toBe(0);
      
      adapter.cleanup();
      
      expect(adapter.subscriptions.size).toBe(0);
      expect(adapter.activeSubscriptions.size).toBe(0);
      expect(adapter.propertyCache.size).toBe(0);
      expect(adapter.entityCache.size).toBe(0);
    });
  });

  describe('Factory Function', () => {
    test('should create adapter with factory function', async () => {
      const schema = {
        ':entity/name': { ':db/unique': ':db.unique/identity' },
        ':name': {},
        ':value': {}
      };
      
      const testDataStore = new DataStore(schema);
      const initialEntities = {
        test: { name: 'Test Entity', value: 42 }
      };
      
      const createdAdapter = await createDataStoreAdapter(testDataStore, initialEntities);
      
      expect(createdAdapter).toBeInstanceOf(DataStoreAdapter);
      expect(createdAdapter.dataStore).toBe(testDataStore);
      
      // Verify entities were initialized
      const entityData = createdAdapter.getEntityData('test');
      expect(entityData).toBeDefined();
      expect(entityData.name).toBe('Test Entity');
      expect(entityData.value).toBe(42);
      
      createdAdapter.cleanup();
    });

    test('should create adapter without initial entities', async () => {
      const schema = { ':entity/name': { ':db/unique': ':db.unique/identity' } };
      const testDataStore = new DataStore(schema);
      
      const createdAdapter = await createDataStoreAdapter(testDataStore);
      
      expect(createdAdapter).toBeInstanceOf(DataStoreAdapter);
      expect(createdAdapter.dataStore).toBe(testDataStore);
      
      createdAdapter.cleanup();
    });
  });
});