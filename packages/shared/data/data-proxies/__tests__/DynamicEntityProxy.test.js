/**
 * Tests for DynamicEntityProxy with schema evolution support
 */

import { DynamicEntityProxy, createDynamicEntityProxy } from '../src/DynamicEntityProxy.js';
import { DynamicDataStore, createDynamicDataStore } from '@legion/data-store';

describe('DynamicEntityProxy', () => {
  let dataStore;
  let dataSource;
  
  beforeEach(() => {
    // Create DynamicDataStore with initial schema
    dataStore = createDynamicDataStore({
      schema: {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      }
    });
    
    // Create a resource manager that wraps the data store
    // Must implement all methods required by Handle validation
    dataSource = {
      dataStore,
      query: (spec) => dataStore.query(spec),
      update: (entityId, data) => {
        // Update entity and return the result
        const result = dataStore.updateEntity(entityId, data);
        return result;
      },
      subscribe: (spec, callback) => {
        // Simplified subscription
        return { unsubscribe: () => {} };
      },
      getSchema: () => dataStore.schema || {},
      queryBuilder: (sourceHandle) => {
        // Simple query builder implementation for testing
        return {
          where: () => this,
          select: () => this,
          first: () => sourceHandle,
          toArray: () => []
        };
      }
    };
  });
  
  describe('Basic Entity Operations', () => {
    it('should create DynamicEntityProxy for entity', () => {
      // Create an entity first
      const result = dataStore.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      // Create proxy for entity
      const proxy = new DynamicEntityProxy(dataSource, result.entityId);
      
      expect(proxy).toBeDefined();
      expect(proxy.entityId).toBe(result.entityId);
    });
    
    it('should access entity attributes through proxy', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Bob',
        ':user/email': 'bob@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Access attributes through standard methods
      expect(proxy.get(':user/name')).toBe('Bob');
      expect(proxy.get(':user/email')).toBe('bob@example.com');
      
      // Get full entity value
      const value = proxy.value();
      expect(value[':user/name']).toBe('Bob');
      expect(value[':user/email']).toBe('bob@example.com');
    });
    
    it('should update entity attributes through proxy', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Charlie',
        ':user/email': 'charlie@example.com'
      });
      
      // Create proxy
      const proxy = new DynamicEntityProxy(dataSource, result.entityId);
      
      // Update attribute
      proxy.set(':user/email', 'charlie.new@example.com');
      
      // Verify update
      expect(proxy.get(':user/email')).toBe('charlie.new@example.com');
    });
    
    it('should access attributes via dynamic properties', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'David',
        ':user/email': 'david@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Access via dynamic properties
      expect(proxy.name).toBe('David');
      expect(proxy.email).toBe('david@example.com');
    });
    
    it('should set attributes via dynamic properties', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Eve',
        ':user/email': 'eve@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Set via dynamic properties
      proxy.email = 'eve.new@example.com';
      
      // Verify update
      expect(proxy.email).toBe('eve.new@example.com');
      expect(proxy.get(':user/email')).toBe('eve.new@example.com');
    });
  });
  
  describe('Schema Evolution', () => {
    it('should handle adding new attributes dynamically', async () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Frank',
        ':user/email': 'frank@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Add new attribute to schema
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      // Set new attribute through proxy
      proxy.set(':user/age', 30);
      
      // Verify attribute was set
      expect(proxy.get(':user/age')).toBe(30);
      expect(proxy.age).toBe(30);
    });
    
    it('should handle removing attributes dynamically', async () => {
      // Create entity with age
      const result = dataStore.createEntity({
        ':user/name': 'Grace',
        ':user/email': 'grace@example.com'
      });
      
      // Update with age
      dataStore.updateEntity(result.entityId, {
        ':user/age': 25
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Verify age exists
      expect(proxy.age).toBe(25);
      
      // Add age attribute to schema first
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      // Remove age attribute from schema (force)
      await dataStore.removeAttribute('user', 'age', true);
      
      // Age should no longer be accessible
      expect(proxy.get(':user/age')).toBeUndefined();
      expect(proxy.age).toBeUndefined();
    });
    
    it('should detect entity type from attributes', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Helen',
        ':user/email': 'helen@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Get entity type
      const entityType = proxy._getEntityType();
      expect(entityType).toBe('user');
    });
    
    it('should list available attributes', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Ivan',
        ':user/email': 'ivan@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Get available attributes
      const attributes = proxy._getAvailableAttributes();
      expect(attributes.has(':user/name')).toBe(true);
      expect(attributes.has(':user/email')).toBe(true);
      expect(attributes.size).toBe(2);
    });
    
    it('should get schema for entity type', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Jack',
        ':user/email': 'jack@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Get schema
      const schema = proxy.getSchema();
      expect(schema[':user/name']).toEqual({ unique: 'identity' });
      expect(schema[':user/email']).toEqual({ unique: 'value' });
    });
  });
  
  describe('Dynamic Property Access', () => {
    it('should support "in" operator for dynamic properties', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Kate',
        ':user/email': 'kate@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Check properties with "in" operator
      expect('name' in proxy).toBe(true);
      expect('email' in proxy).toBe(true);
      expect('age' in proxy).toBe(false);
      expect('entityId' in proxy).toBe(true); // Standard property
    });
    
    it('should enumerate dynamic properties with Object.keys()', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Leo',
        ':user/email': 'leo@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Get keys
      const keys = Object.keys(proxy);
      
      // Should include dynamic properties
      expect(keys).toContain('name');
      expect(keys).toContain('email');
    });
    
    it('should provide property descriptors for dynamic properties', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Mary',
        ':user/email': 'mary@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Get property descriptor
      const descriptor = Object.getOwnPropertyDescriptor(proxy, 'name');
      expect(descriptor).toBeDefined();
      expect(descriptor.enumerable).toBe(true);
      expect(descriptor.configurable).toBe(true);
      expect(typeof descriptor.get).toBe('function');
      expect(typeof descriptor.set).toBe('function');
    });
  });
  
  describe('Schema Change Notifications', () => {
    it('should handle schema change callbacks', async () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Nancy',
        ':user/email': 'nancy@example.com'
      });
      
      // Track schema changes
      const schemaChanges = [];
      
      // Create proxy with schema change handler
      const proxy = new DynamicEntityProxy(dataSource, result.entityId, {
        onSchemaChange: (change) => {
          schemaChanges.push(change);
        }
      });
      
      // Add new attribute
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      // Should have received notification
      expect(schemaChanges.length).toBeGreaterThan(0);
      const change = schemaChanges[0];
      expect(change.entityId).toBe(result.entityId);
      expect(change.change.type).toBe('addAttribute');
    });
  });
  
  describe('Resource Cleanup', () => {
    it('should clean up subscriptions on destroy', () => {
      // Create entity
      const result = dataStore.createEntity({
        ':user/name': 'Oscar',
        ':user/email': 'oscar@example.com'
      });
      
      // Create proxy
      const proxy = createDynamicEntityProxy(dataSource, result.entityId);
      
      // Destroy proxy
      proxy.destroy();
      
      // Should be marked as destroyed
      expect(proxy.isDestroyed()).toBe(true);
      
      // Should throw on access
      expect(() => proxy.value()).toThrow('Handle has been destroyed');
    });
  });
});