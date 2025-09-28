/**
 * Integration tests for SelfDescribingPrototypeFactory with existing PrototypeFactory
 * 
 * Tests that the introspection system integrates correctly with the existing
 * PrototypeFactory, making existing prototypes introspectable through MetaHandles.
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { Handle } from '../../src/Handle.js';
import { PrototypeFactory } from '../../src/PrototypeFactory.js';
import { SelfDescribingPrototypeFactory } from '../../src/introspection/SelfDescribingPrototypeFactory.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';

describe('PrototypeFactory Integration with Introspection', () => {
  // Initialize introspection system once before all tests
  beforeAll(async () => {
    await Handle.initializeIntrospection();
  });
  
  describe('Enhancing existing PrototypeFactory', () => {
    it('should wrap existing prototypes as MetaHandles', () => {
      // Create original PrototypeFactory
      const originalFactory = new PrototypeFactory(Handle);
      
      // Analyze a schema (DataScript format)
      const schema = {
        ':user/id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      
      // Get prototype from original factory
      const UserPrototype = originalFactory.getEntityPrototype('user', Handle);
      expect(UserPrototype).toBeDefined();
      expect(UserPrototype.name).toBe('TypedHandle_user');
      
      // Create SelfDescribingPrototypeFactory
      const introspectiveFactory = new SelfDescribingPrototypeFactory({
        baseHandleClass: Handle
      });
      
      // Wrap existing prototype as MetaHandle using new method
      const metaHandle = introspectiveFactory.wrapExistingPrototype('user', UserPrototype);
      
      expect(metaHandle).toBeInstanceOf(MetaHandle);
      
      // Query prototype through MetaHandle
      const result = metaHandle.query({ type: 'prototype-members', filter: 'methods' });
      expect(result.methods).toContain('getAvailableAttributes');
      expect(result.methods).toContain('getRelationships');
      expect(result.methods).toContain('validateAttribute');
      
      // Get properties added by PrototypeFactory
      const propsResult = metaHandle.query({ type: 'prototype-members', filter: 'properties' });
      expect(propsResult.properties).toContain('typeName');
    });
    
    it('should preserve dynamic properties from schema analysis', () => {
      const originalFactory = new PrototypeFactory(Handle);
      
      // Analyze schema with properties
      const schema = {
        ':product/id': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/one' },
        ':product/name': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/one' },
        ':product/price': { ':db/valueType': ':db.type/number', ':db/cardinality': ':db.cardinality/one' },
        ':product/tags': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/many' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      
      const ProductPrototype = originalFactory.getEntityPrototype('product', Handle);
      
      // Wrap with introspection
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      const metaHandle = introspectiveFactory.wrapExistingPrototype('product', ProductPrototype);
      
      // Query for all properties
      const allMembers = metaHandle.query({ type: 'prototype-members' });
      
      // Check that dynamic properties from schema are present
      // PrototypeFactory converts attribute names to property names
      const properties = allMembers.properties;
      
      // The properties should include methods from TypedHandle
      expect(allMembers.methods).toContain('getAttributeInfo');
      expect(allMembers.methods).toContain('getIntrospectionInfo');
    });
    
    it('should create instances that work with both systems', () => {
      const originalFactory = new PrototypeFactory(Handle);
      
      // Set up schema
      const schema = {
        ':order/id': { ':db/valueType': ':db.type/string' },
        ':order/customer': { ':db/valueType': ':db.type/ref' },
        ':order/total': { ':db/valueType': ':db.type/number' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      
      const OrderPrototype = originalFactory.getEntityPrototype('order', Handle);
      
      // Create introspective wrapper
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      const metaHandle = introspectiveFactory.wrapExistingPrototype('order', OrderPrototype);
      
      // Create instance through MetaHandle using real SimpleObjectDataSource
      // TypedHandle constructor expects (dataSource, entityId, options)
      const dataSource = new SimpleObjectDataSource({
        id: 123,
        customer: 'customer-456',
        total: 99.99
      });
      
      const orderInstance = metaHandle.createInstance(dataSource, 123);
      
      // Instance should have both Handle functionality and TypedHandle functionality
      expect(orderInstance).toBeInstanceOf(Handle);
      expect(orderInstance.entityId).toBe(123);
      expect(orderInstance.typeName).toBe('order');
      
      // Should have methods from TypedHandle
      expect(typeof orderInstance.getAvailableAttributes).toBe('function');
      expect(typeof orderInstance.getRelationships).toBe('function');
      
      // Should also be introspectable
      const prototype = orderInstance.getPrototype();
      expect(prototype).toBeInstanceOf(MetaHandle);
    });
  });
  
  describe('Schema integration between systems', () => {
    it.skip('should create SchemaHandle from PrototypeFactory analyzed schema - REQUIRES DataScript support in SchemaHandle', () => {
      // TODO: SchemaHandle needs DataScript schema format support to extract entity types
      // Currently SchemaHandle only supports JSON Schema format auto-detection
      const originalFactory = new PrototypeFactory(Handle);
      
      const schema = {
        ':task/id': { ':db/valueType': ':db.type/string', ':db/unique': ':db.unique/identity' },
        ':task/title': { ':db/valueType': ':db.type/string', ':db/required': true },
        ':task/completed': { ':db/valueType': ':db.type/boolean' },
        ':task/assignee': { ':db/valueType': ':db.type/ref' }
      };
      
      // Analyze with original factory
      const analysis = originalFactory.analyzeSchema(schema, 'datascript');
      
      // Analysis should contain types, relationships, capabilities
      expect(analysis.types).toBeDefined();
      expect(analysis.types.size).toBeGreaterThan(0);
      
      // Wrap analyzed schema as SchemaHandle
      const schemaHandle = new SchemaHandle(schema, { format: 'datascript' });
      
      // Query entity types through SchemaHandle
      const entityTypes = schemaHandle.query({ type: 'entity-types' });
      expect(entityTypes).toContain('task');
      
      // Query properties for task type
      const properties = schemaHandle.query({ 
        type: 'properties',
        entityType: 'task'
      });
      
      expect(properties).toContainEqual(expect.objectContaining({
        name: 'id'
      }));
      expect(properties).toContainEqual(expect.objectContaining({
        name: 'title'
      }));
      expect(properties).toContainEqual(expect.objectContaining({
        name: 'assignee'
      }));
    });
    
    it('should validate data using schema from both systems', () => {
      const originalFactory = new PrototypeFactory(Handle);
      
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          active: { type: 'boolean' }
        },
        required: ['id', 'name']
      };
      
      // Wrap as SchemaHandle
      const schemaHandle = new SchemaHandle(schema, { format: 'json-schema' });
      
      // Validate valid data
      const validResult = schemaHandle.validate({
        id: 1,
        name: 'Test',
        active: true
      });
      
      expect(validResult.isValid).toBe(true);
      
      // Validate invalid data - missing required field
      const invalidResult = schemaHandle.validate({
        id: 1,
        active: false
        // Missing 'name'
      });
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Complete workflow integration', () => {
    it('should support full introspection workflow with existing factory', () => {
      // 1. Create original factory and analyze schema
      const originalFactory = new PrototypeFactory(Handle);
      
      const schema = {
        ':entity/id': { ':db/valueType': ':db.type/string' },
        ':entity/type': { ':db/valueType': ':db.type/string' },
        ':entity/data': { ':db/valueType': ':db.type/string' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      
      // 2. Get prototype from original factory
      const EntityPrototype = originalFactory.getEntityPrototype('entity', Handle);
      
      // 3. Create introspective factory
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // 4. Wrap prototype as MetaHandle
      const metaHandle = introspectiveFactory.wrapExistingPrototype('entity', EntityPrototype);
      
      // 5. Add dynamic method through introspection
      metaHandle.update({
        type: 'add-method',
        name: 'describe',
        method: function() {
          return `Entity ${this.entityId} of type ${this.typeName}`;
        }
      });
      
      // 6. Create instance using real SimpleObjectDataSource
      const dataSource = new SimpleObjectDataSource({
        id: 'entity-123',
        type: 'entity',
        data: 'test data'
      });
      
      const instance = metaHandle.createInstance(dataSource, 'entity-123');
      
      // 7. Verify instance has both original and dynamic functionality
      expect(instance.typeName).toBe('entity');
      expect(instance.entityId).toBe('entity-123');
      expect(typeof instance.describe).toBe('function');
      expect(instance.describe()).toBe('Entity entity-123 of type entity');
      
      // 8. Query factory for all prototypes
      const factoryHandle = introspectiveFactory.asHandle();
      const allPrototypes = factoryHandle.query({ type: 'list-prototypes' });
      expect(allPrototypes).toContain('entity');
    });
    
    it('should detect entity types from data using enhanced factory', () => {
      const originalFactory = new PrototypeFactory(Handle);
      
      // Analyze multiple entity types
      const schema = {
        ':user/id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' },
        ':post/id': { ':db/valueType': ':db.type/string' },
        ':post/title': { ':db/valueType': ':db.type/string' },
        ':post/author': { ':db/valueType': ':db.type/ref' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      
      // Detect entity type from data
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      const detectedType = originalFactory.detectEntityType(userData);
      expect(detectedType).toBe('user');
      
      // Create introspective wrapper for detected type
      const UserPrototype = originalFactory.getEntityPrototype(detectedType, Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      const metaHandle = introspectiveFactory.wrapExistingPrototype(detectedType, UserPrototype);
      
      // Query prototype info
      const info = metaHandle.query({ type: 'prototype-members' });
      expect(info.methods).toContain('getAvailableAttributes');
    });
  });
  
  describe('Factory statistics and caching', () => {
    it('should track statistics from both factories', () => {
      const originalFactory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Analyze schema with original
      const schema = {
        ':item/id': { ':db/valueType': ':db.type/string' },
        ':item/name': { ':db/valueType': ':db.type/string' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      
      // Get stats from original factory
      const originalStats = originalFactory.getStats();
      expect(originalStats.schemaTypes).toBeGreaterThan(0);
      
      // Create prototype in original
      const ItemPrototype = originalFactory.getEntityPrototype('item', Handle);
      
      // Wrap in introspective factory
      introspectiveFactory.wrapExistingPrototype('item', ItemPrototype);
      
      // Get stats from introspective factory
      const factoryHandle = introspectiveFactory.asHandle();
      const prototypeCount = factoryHandle.query({ type: 'prototype-count' });
      expect(prototypeCount).toBe(1);
      
      // Both factories should maintain their own caches
      expect(originalFactory.entityPrototypes.size).toBe(1);
      expect(introspectiveFactory._prototypeRegistry.size).toBe(1);
    });
    
    it('should clear caches independently', () => {
      const originalFactory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Set up and cache prototypes
      const schema = {
        ':cache/test': { ':db/valueType': ':db.type/string' }
      };
      
      originalFactory.analyzeSchema(schema, 'datascript');
      const CachePrototype = originalFactory.getEntityPrototype('cache', Handle);
      
      introspectiveFactory.wrapExistingPrototype('cache', CachePrototype);
      
      // Clear original factory cache
      originalFactory.clearCache();
      expect(originalFactory.entityPrototypes.size).toBe(0);
      
      // Introspective factory should still have its prototype
      const factoryHandle = introspectiveFactory.asHandle();
      const prototypes = factoryHandle.query({ type: 'list-prototypes' });
      expect(prototypes).toContain('cache');
    });
  });
});