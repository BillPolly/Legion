/**
 * Comprehensive End-to-End Introspection Tests
 * 
 * This test suite validates the complete introspection system working together:
 * - Handle introspection through getPrototype()
 * - SchemaHandle with DataSource.getSchema()
 * - MetaHandle wrapping prototypes
 * - SelfDescribingPrototypeFactory
 * - PrototypeFactory integration
 * - Cross-resource introspection
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { Handle } from '../../src/Handle.js';
import { PrototypeFactory } from '../../src/PrototypeFactory.js';
import { SelfDescribingPrototypeFactory } from '../../src/introspection/SelfDescribingPrototypeFactory.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Comprehensive Introspection E2E Tests', () => {
  let factory;
  let introspectiveFactory;
  let objectDataSource;
  let mongoDataSource;
  let fileDataSource;
  
  beforeAll(async () => {
    // Initialize introspection once
    await Handle.initializeIntrospection();
  });
  
  beforeEach(() => {
    // Create factories
    factory = new PrototypeFactory(Handle);
    introspectiveFactory = new SelfDescribingPrototypeFactory();
    
    // Create various DataSources for testing
    objectDataSource = new SimpleObjectDataSource({
      id: 'test-123',
      name: 'Test Entity',
      type: 'object',
      metadata: {
        created: new Date('2024-01-01'),
        version: '1.0.0'
      }
    });
    
    // Mock MongoDB-like DataSource
    mongoDataSource = {
      _db: new Map([
        ['user:1', { id: 'user:1', name: 'Alice', role: 'admin' }],
        ['user:2', { id: 'user:2', name: 'Bob', role: 'user' }],
        ['product:1', { id: 'product:1', name: 'Widget', price: 99.99 }]
      ]),
      
      query: function(querySpec) {
        if (querySpec.type === 'find' && querySpec.id) {
          return this._db.get(querySpec.id) || null;
        }
        if (querySpec.type === 'findAll') {
          return Array.from(this._db.values());
        }
        return null;
      },
      
      subscribe: function(querySpec, callback) {
        return { unsubscribe: () => {} };
      },
      
      queryBuilder: function(sourceHandle) {
        return {
          collection: null,
          filter: {},
          
          from: function(coll) {
            this.collection = coll;
            return this;
          },
          
          where: function(field, op, value) {
            this.filter[field] = { [op]: value };
            return this;
          },
          
          build: function() {
            return { type: 'find', collection: this.collection, filter: this.filter };
          }
        };
      },
      
      getSchema: function() {
        return {
          type: 'mongodb',
          collections: {
            users: {
              ':user/id': { ':db/valueType': ':db.type/string' },
              ':user/name': { ':db/valueType': ':db.type/string' },
              ':user/role': { ':db/valueType': ':db.type/string' }
            },
            products: {
              ':product/id': { ':db/valueType': ':db.type/string' },
              ':product/name': { ':db/valueType': ':db.type/string' },
              ':product/price': { ':db/valueType': ':db.type/number' }
            }
          }
        };
      }
    };
    
    // Mock File-like DataSource
    const testDir = path.join(__dirname, '../tmp/e2e-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    fileDataSource = {
      basePath: testDir,
      
      query: function(querySpec) {
        if (querySpec.type === 'read-file' && querySpec.path) {
          const filePath = path.join(this.basePath, querySpec.path);
          if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
          }
          return null;
        }
        if (querySpec.type === 'list-files') {
          return fs.readdirSync(this.basePath);
        }
        return null;
      },
      
      subscribe: function(querySpec, callback) {
        return { unsubscribe: () => {} };
      },
      
      queryBuilder: function(sourceHandle) {
        return null;
      },
      
      getSchema: function() {
        return {
          type: 'file-system',
          operations: {
            'read-file': { parameters: { path: 'string' }, returns: 'string' },
            'list-files': { returns: 'array' }
          }
        };
      }
    };
  });
  
  afterEach(() => {
    // Cleanup test directory
    const testDir = path.join(__dirname, '../tmp/e2e-test');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Complete introspection workflow', () => {
    it('should introspect a simple Handle through all layers', () => {
      // Create a basic Handle
      const handle = new Handle(objectDataSource);
      
      // 1. Handle introspection via getPrototype()
      const prototype = handle.getPrototype();
      expect(prototype).toBeInstanceOf(MetaHandle);
      
      // 2. Query prototype members
      const members = prototype.query({ type: 'prototype-members' });
      expect(members).toHaveProperty('methods');
      expect(members).toHaveProperty('properties');
      expect(Array.isArray(members.methods)).toBe(true);
      
      // 3. Get prototype metadata
      const metadata = prototype.query({ type: 'metadata' });
      expect(metadata.name).toBe('Handle');
      expect(metadata.isClass).toBe(true);
      
      // 4. Get inheritance chain
      const chain = prototype.query({ type: 'inheritance-chain' });
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
    });
    
    it('should create typed Handles with full introspection', () => {
      // Define schema
      const schema = {
        ':entity/id': { ':db/valueType': ':db.type/string' },
        ':entity/name': { ':db/valueType': ':db.type/string' },
        ':entity/tags': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/many' },
        ':entity/active': { ':db/valueType': ':db.type/boolean' }
      };
      
      // Analyze schema
      factory.analyzeSchema(schema, 'datascript');
      
      // Create typed prototype
      const EntityPrototype = factory.getEntityPrototype('entity', Handle);
      
      // Wrap in MetaHandle
      const entityMeta = introspectiveFactory.wrapExistingPrototype('entity', EntityPrototype);
      
      // Create instance
      const entityInstance = entityMeta.createInstance(objectDataSource, 'entity-1');
      
      // Test introspection at all levels
      
      // Instance level
      expect(entityInstance.typeName).toBe('entity');
      expect(entityInstance.getAvailableAttributes()).toContain('id');
      expect(entityInstance.getAvailableAttributes()).toContain('name');
      expect(entityInstance.getAvailableAttributes()).toContain('tags');
      expect(entityInstance.getAvailableAttributes()).toContain('active');
      
      // Prototype level
      const instancePrototype = entityInstance.getPrototype();
      expect(instancePrototype).toBeInstanceOf(MetaHandle);
      
      // Meta level
      const typeName = entityMeta.getTypeName();
      expect(typeName).toBe('entity');
      
      // Query instances from MetaHandle
      const instances = entityMeta.query({ type: 'instances' });
      expect(instances).toContain(entityInstance);
    });
    
    it('should handle schema evolution and introspection', () => {
      // Initial schema
      let schema = {
        ':doc/id': { ':db/valueType': ':db.type/string' },
        ':doc/title': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const DocV1 = factory.getEntityPrototype('doc', Handle);
      const docMetaV1 = introspectiveFactory.wrapExistingPrototype('doc-v1', DocV1);
      
      const instanceV1 = docMetaV1.createInstance(objectDataSource, 'doc-1');
      const attrsV1 = instanceV1.getAvailableAttributes();
      expect(attrsV1).toHaveLength(2);
      
      // Evolve schema
      factory.clearCache();
      schema = {
        ':doc/id': { ':db/valueType': ':db.type/string' },
        ':doc/title': { ':db/valueType': ':db.type/string' },
        ':doc/content': { ':db/valueType': ':db.type/string' },
        ':doc/author': { ':db/valueType': ':db.type/ref' },
        ':doc/tags': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/many' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const DocV2 = factory.getEntityPrototype('doc', Handle);
      const docMetaV2 = introspectiveFactory.wrapExistingPrototype('doc-v2', DocV2);
      
      const instanceV2 = docMetaV2.createInstance(objectDataSource, 'doc-2');
      const attrsV2 = instanceV2.getAvailableAttributes();
      expect(attrsV2).toHaveLength(5);
      expect(attrsV2).toContain('content');
      expect(attrsV2).toContain('author');
      expect(attrsV2).toContain('tags');
      
      // Both versions should have proper introspection
      const protoV1 = instanceV1.getPrototype();
      const protoV2 = instanceV2.getPrototype();
      
      expect(protoV1).toBeInstanceOf(MetaHandle);
      expect(protoV2).toBeInstanceOf(MetaHandle);
    });
  });
  
  describe('Factory as a Handle', () => {
    it('should query factory itself as a Handle', () => {
      // Create some prototypes
      introspectiveFactory.createPrototype('type1', Handle);
      introspectiveFactory.createPrototype('type2', Handle);
      introspectiveFactory.createPrototype('type3', Handle);
      
      // Get factory as Handle
      const factoryHandle = introspectiveFactory.asHandle();
      expect(factoryHandle).toBeInstanceOf(Handle);
      
      // Query prototype list
      const prototypeList = factoryHandle.query({ type: 'list-prototypes' });
      expect(prototypeList).toHaveLength(3);
      expect(prototypeList).toContain('type1');
      expect(prototypeList).toContain('type2');
      expect(prototypeList).toContain('type3');
      
      // Get prototype count
      const count = factoryHandle.query({ type: 'prototype-count' });
      expect(count).toBe(3);
      
      // Get specific prototype
      const type1Meta = factoryHandle.query({ 
        type: 'get-prototype', 
        typeName: 'type1' 
      });
      expect(type1Meta).toBeInstanceOf(MetaHandle);
    });
    
    it('should support subscription to factory events', () => {
      let createdEvent = null;
      let removedEvent = null;
      
      // Subscribe to prototype creation
      const createSub = introspectiveFactory.subscribe(
        { type: 'prototype-created' },
        (event) => { createdEvent = event; }
      );
      
      // Subscribe to prototype removal
      const removeSub = introspectiveFactory.subscribe(
        { type: 'prototype-removed' },
        (event) => { removedEvent = event; }
      );
      
      // Create a prototype
      introspectiveFactory.createPrototype('test-type', Handle);
      expect(createdEvent).toBeDefined();
      expect(createdEvent.typeName).toBe('test-type');
      expect(createdEvent.metaHandle).toBeInstanceOf(MetaHandle);
      
      // Remove the prototype
      introspectiveFactory.removePrototype('test-type');
      expect(removedEvent).toBeDefined();
      expect(removedEvent.typeName).toBe('test-type');
      
      // Unsubscribe
      createSub.unsubscribe();
      removeSub.unsubscribe();
    });
  });
  
  describe('SchemaHandle integration', () => {
    it('should introspect schemas through SchemaHandle', () => {
      // Get schema from MongoDB DataSource and create SchemaHandle
      const schema = mongoDataSource.getSchema();
      const schemaHandle = new SchemaHandle(schema);
      
      // Query schema
      const schemaValue = schemaHandle.value();
      expect(schemaValue.type).toBe('mongodb');
      expect(schemaValue.collections).toBeDefined();
      expect(schemaValue.collections.users).toBeDefined();
      expect(schemaValue.collections.products).toBeDefined();
      
      // Query schema structure
      const structure = schemaHandle.query({ type: 'schema-metadata' });
      expect(structure).toBeDefined();
      
      // Query entity types
      const entities = schemaHandle.query({ type: 'entity-types' });
      expect(entities).toContain('users');
      expect(entities).toContain('products');
      
      // Get SchemaHandle's prototype
      const schemaPrototype = schemaHandle.getPrototype();
      expect(schemaPrototype).toBeInstanceOf(MetaHandle);
    });
    
    it('should extract entity types from DataScript schemas', () => {
      const schema = mongoDataSource.getSchema();
      const schemaHandle = new SchemaHandle(schema);
      
      // Test entity extraction from collections
      const entities = schemaHandle.query({ type: 'entity-types' });
      expect(entities).toContain('users');
      expect(entities).toContain('products');
      
      // Get properties for entity type
      const userProps = schemaHandle.query({ 
        type: 'properties', 
        entityType: 'users' 
      });
      const userPropNames = userProps.map(p => p.name);
      expect(userPropNames).toContain('id');
      expect(userPropNames).toContain('name');
      expect(userPropNames).toContain('role');
    });
  });
  
  describe('Cross-resource uniform introspection', () => {
    it('should provide uniform introspection across all resource types', () => {
      // Create Handles for different resource types
      const objectHandle = new Handle(objectDataSource);
      const mongoHandle = new Handle(mongoDataSource);
      const fileHandle = new Handle(fileDataSource);
      
      const handles = [objectHandle, mongoHandle, fileHandle];
      
      // All should support introspection
      for (const handle of handles) {
        // Get prototype
        const prototype = handle.getPrototype();
        expect(prototype).toBeInstanceOf(MetaHandle);
        
        // Query prototype members
        const members = prototype.query({ type: 'prototype-members' });
        expect(members).toHaveProperty('methods');
        expect(members).toHaveProperty('properties');
        
        // Get metadata
        const metadata = prototype.query({ type: 'metadata' });
        expect(metadata.name).toBe('Handle');
        
        // All have same base methods
        expect(typeof handle.query).toBe('function');
        expect(typeof handle.subscribe).toBe('function');
        expect(typeof handle.getPrototype).toBe('function');
      }
    });
    
    it('should create typed instances across resource boundaries', () => {
      // Define unified schema
      const schema = {
        ':resource/id': { ':db/valueType': ':db.type/string' },
        ':resource/name': { ':db/valueType': ':db.type/string' },
        ':resource/type': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const ResourcePrototype = factory.getEntityPrototype('resource', Handle);
      const resourceMeta = introspectiveFactory.wrapExistingPrototype('resource', ResourcePrototype);
      
      // Create instances with different DataSources
      const objectInstance = resourceMeta.createInstance(objectDataSource, 'obj-1');
      const mongoInstance = resourceMeta.createInstance(mongoDataSource, 'user:1');
      const fileInstance = resourceMeta.createInstance(fileDataSource, 'test.txt');
      
      // All should have same type but different DataSources
      expect(objectInstance.typeName).toBe('resource');
      expect(mongoInstance.typeName).toBe('resource');
      expect(fileInstance.typeName).toBe('resource');
      
      // All should support introspection
      const instances = [objectInstance, mongoInstance, fileInstance];
      
      for (const instance of instances) {
        const prototype = instance.getPrototype();
        expect(prototype).toBeInstanceOf(MetaHandle);
        
        const attrs = instance.getAvailableAttributes();
        expect(attrs).toContain('id');
        expect(attrs).toContain('name');
        expect(attrs).toContain('type');
      }
    });
  });
  
  describe('Dynamic runtime modifications', () => {
    it('should add methods to prototypes at runtime', () => {
      // Create a prototype
      const proto = introspectiveFactory.createPrototype('dynamic', Handle);
      
      // Add a method at runtime
      const result = proto.update({
        type: 'add-method',
        name: 'customMethod',
        method: function() { return 'custom result'; }
      });
      
      expect(result).toBe(true);
      
      // Verify method was added
      const methods = proto.query({ type: 'methods' });
      const customMethod = methods.find(m => m.name === 'customMethod');
      expect(customMethod).toBeDefined();
      
      // Create instance and test the new method
      const instance = proto.createInstance(objectDataSource, 'dynamic-1');
      expect(typeof instance.customMethod).toBe('function');
      expect(instance.customMethod()).toBe('custom result');
    });
    
    it('should track prototype modifications through subscriptions', () => {
      const proto = introspectiveFactory.createPrototype('tracked', Handle);
      
      let modificationEvent = null;
      
      // Subscribe to modifications
      const subscription = proto.subscribe(
        { type: 'modification' },
        (event) => { modificationEvent = event; }
      );
      
      // Add a property
      proto.update({
        type: 'add-property',
        name: 'customProp',
        value: 'initial value'
      });
      
      expect(modificationEvent).toBeDefined();
      expect(modificationEvent.type).toBe('property-added');
      expect(modificationEvent.name).toBe('customProp');
      
      // Unsubscribe
      subscription.unsubscribe();
    });
  });
  
  describe('Performance and scalability', () => {
    it('should efficiently handle many prototype types', () => {
      const startTime = Date.now();
      
      // Create many prototypes
      for (let i = 0; i < 100; i++) {
        introspectiveFactory.createPrototype(`type-${i}`, Handle);
      }
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(1000); // Should be fast
      
      // Query all prototypes
      const queryStart = Date.now();
      const allNames = introspectiveFactory.getPrototypeNames();
      const queryTime = Date.now() - queryStart;
      
      expect(allNames).toHaveLength(100);
      expect(queryTime).toBeLessThan(100); // Query should be very fast
      
      // Random access should be O(1)
      const accessStart = Date.now();
      const proto50 = introspectiveFactory.getPrototypeHandle('type-50');
      const accessTime = Date.now() - accessStart;
      
      expect(proto50).toBeInstanceOf(MetaHandle);
      expect(accessTime).toBeLessThan(10); // Should be instant
    });
    
    it('should handle complex schema hierarchies', () => {
      // Create a complex schema with multiple entity types
      const complexSchema = {
        ':company/id': { ':db/valueType': ':db.type/string' },
        ':company/name': { ':db/valueType': ':db.type/string' },
        ':company/employees': { ':db/valueType': ':db.type/ref', ':db/cardinality': ':db.cardinality/many' },
        ':employee/id': { ':db/valueType': ':db.type/string' },
        ':employee/name': { ':db/valueType': ':db.type/string' },
        ':employee/department': { ':db/valueType': ':db.type/ref' },
        ':employee/manager': { ':db/valueType': ':db.type/ref' },
        ':department/id': { ':db/valueType': ':db.type/string' },
        ':department/name': { ':db/valueType': ':db.type/string' },
        ':department/budget': { ':db/valueType': ':db.type/number' },
        ':project/id': { ':db/valueType': ':db.type/string' },
        ':project/name': { ':db/valueType': ':db.type/string' },
        ':project/team': { ':db/valueType': ':db.type/ref', ':db/cardinality': ':db.cardinality/many' }
      };
      
      factory.analyzeSchema(complexSchema, 'datascript');
      
      // Should detect all entity types
      const stats = factory.getStats();
      expect(stats.schemaTypes).toBe(4); // company, employee, department, project
      
      // Create prototypes for all types
      const CompanyProto = factory.getEntityPrototype('company', Handle);
      const EmployeeProto = factory.getEntityPrototype('employee', Handle);
      const DepartmentProto = factory.getEntityPrototype('department', Handle);
      const ProjectProto = factory.getEntityPrototype('project', Handle);
      
      // Wrap in MetaHandles
      const companyMeta = introspectiveFactory.wrapExistingPrototype('company', CompanyProto);
      const employeeMeta = introspectiveFactory.wrapExistingPrototype('employee', EmployeeProto);
      const departmentMeta = introspectiveFactory.wrapExistingPrototype('department', DepartmentProto);
      const projectMeta = introspectiveFactory.wrapExistingPrototype('project', ProjectProto);
      
      // Create instances
      const company = companyMeta.createInstance(mongoDataSource, 'company:1');
      const employee = employeeMeta.createInstance(mongoDataSource, 'employee:1');
      const department = departmentMeta.createInstance(mongoDataSource, 'department:1');
      const project = projectMeta.createInstance(mongoDataSource, 'project:1');
      
      // All should have correct types and relationships
      expect(company.getRelationships()).toContainEqual(
        expect.objectContaining({ name: 'employees', cardinality: 'many' })
      );
      
      expect(employee.getRelationships()).toContainEqual(
        expect.objectContaining({ name: 'department', cardinality: 'one' })
      );
      
      expect(employee.getRelationships()).toContainEqual(
        expect.objectContaining({ name: 'manager', cardinality: 'one' })
      );
    });
  });
  
  describe('Error handling and edge cases', () => {
    it('should handle invalid prototype names gracefully', () => {
      expect(() => {
        introspectiveFactory.createPrototype('', Handle);
      }).toThrow('Prototype type name must be a non-empty string');
      
      expect(() => {
        introspectiveFactory.createPrototype(null, Handle);
      }).toThrow('Prototype type name must be a non-empty string');
    });
    
    it('should prevent duplicate prototype names', () => {
      introspectiveFactory.createPrototype('unique', Handle);
      
      expect(() => {
        introspectiveFactory.createPrototype('unique', Handle);
      }).toThrow("Prototype with name 'unique' already exists");
    });
    
    it('should handle missing DataSource gracefully', () => {
      const proto = introspectiveFactory.createPrototype('test', Handle);
      
      // Creating instance without DataSource should auto-create one
      const instance = proto.createInstance();
      expect(instance).toBeDefined();
      expect(instance.getPrototype()).toBeInstanceOf(MetaHandle);
    });
    
    it('should handle destroyed Handles', () => {
      const handle = new Handle(objectDataSource);
      const prototype = handle.getPrototype();
      
      // Destroy the handle
      handle.destroy();
      
      // Should not be able to get prototype from destroyed handle
      expect(() => handle.getPrototype()).toThrow('Handle has been destroyed');
      
      // But the prototype MetaHandle should still work
      const members = prototype.query({ type: 'prototype-members' });
      expect(members).toHaveProperty('methods');
    });
  });
});