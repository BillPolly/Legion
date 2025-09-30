/**
 * PrototypeFactory.test.js - Unit tests for PrototypeFactory
 * 
 * Tests the universal prototype manufacturing system for Handle introspection.
 */

import { PrototypeFactory } from '../../src/PrototypeFactory.js';
import { Handle } from '../../src/Handle.js';
import { createMockDataSource, createMockFunction } from '../testUtils.js';

describe('PrototypeFactory', () => {
  let factory;
  let mockDataSource;

  beforeEach(() => {
    factory = new PrototypeFactory();
    
    // Mock DataSource for prototype testing
    mockDataSource = createMockDataSource();
  });

  describe('Constructor', () => {
    test('should initialize empty factory', () => {
      expect(factory.entityPrototypes).toBeInstanceOf(Map);
      expect(factory.entityPrototypes.size).toBe(0);
      expect(factory.schemaTypes).toBeInstanceOf(Map);
      expect(factory.schemaAdapters).toBeInstanceOf(Map);
      expect(factory.schemaAdapters.size).toBeGreaterThan(0); // Has default adapters
    });

    test('should accept base handle class', () => {
      const customFactory = new PrototypeFactory(Handle);
      expect(customFactory.baseHandleClass).toBe(Handle);
    });

    test('should register default schema adapters', () => {
      expect(factory.schemaAdapters.has('datascript')).toBe(true);
      expect(factory.schemaAdapters.has('json-schema')).toBe(true);
    });
  });

  describe('Schema Analysis', () => {
    test('should reject invalid schemas', () => {
      expect(() => factory.analyzeSchema(null)).toThrow('Schema must be a non-null object');
      expect(() => factory.analyzeSchema('string')).toThrow('Schema must be a non-null object');
      expect(() => factory.analyzeSchema(123)).toThrow('Schema must be a non-null object');
    });

    test('should analyze DataScript schema', () => {
      const dataScriptSchema = {
        ':user/name': {
          ':db/valueType': ':db.type/string',
          ':db/cardinality': ':db.cardinality/one'
        },
        ':user/email': {
          ':db/valueType': ':db.type/string', 
          ':db/cardinality': ':db.cardinality/one',
          ':db/required': true
        },
        ':user/friends': {
          ':db/valueType': ':db.type/ref',
          ':db/cardinality': ':db.cardinality/many'
        }
      };

      const result = factory.analyzeSchema(dataScriptSchema, 'datascript');

      expect(result.types.has('user')).toBe(true);
      
      const userType = result.types.get('user');
      expect(userType.name).toBe('user');
      expect(userType.attributes.has('name')).toBe(true);
      expect(userType.attributes.has('email')).toBe(true);
      expect(userType.attributes.has('friends')).toBe(true);

      const nameAttr = userType.attributes.get('name');
      expect(nameAttr.fullName).toBe(':user/name');
      expect(nameAttr.type).toBe('string');
      expect(nameAttr.cardinality).toBe('one');

      const emailAttr = userType.attributes.get('email');
      expect(emailAttr.required).toBe(true);

      // Should detect relationships
      expect(result.relationships.has('user')).toBe(true);
      const userRelationships = result.relationships.get('user');
      expect(userRelationships.has('friends')).toBe(true);
    });

    test('should analyze JSON Schema', () => {
      const jsonSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        definitions: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
              tags: { type: 'array' },
              active: { type: 'boolean' }
            },
            required: ['name', 'age']
          },
          project: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Project title' },
              owner: { type: 'string' }
            }
          }
        }
      };

      const result = factory.analyzeSchema(jsonSchema, 'json-schema');

      expect(result.types.has('user')).toBe(true);
      expect(result.types.has('project')).toBe(true);

      const userType = result.types.get('user');
      expect(userType.attributes.has('name')).toBe(true);
      expect(userType.attributes.has('age')).toBe(true);
      expect(userType.attributes.has('tags')).toBe(true);

      const nameAttr = userType.attributes.get('name');
      expect(nameAttr.type).toBe('string');
      expect(nameAttr.required).toBe(true);

      const tagsAttr = userType.attributes.get('tags');
      expect(tagsAttr.cardinality).toBe('many'); // Arrays become 'many'
    });

    test('should auto-detect schema format', () => {
      const dataScriptSchema = {
        ':user/name': { ':db/valueType': ':db.type/string' }
      };

      const jsonSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        definitions: { user: { properties: { name: { type: 'string' } } } }
      };

      expect(factory._detectSchemaFormat(dataScriptSchema)).toBe('datascript');
      expect(factory._detectSchemaFormat(jsonSchema)).toBe('json-schema');
      expect(factory._detectSchemaFormat({ custom: true })).toBe('custom');
    });

    test('should reject unsupported schema format', () => {
      expect(() => factory.analyzeSchema({}, 'unsupported')).toThrow('Unsupported schema format: unsupported');
    });
  });

  describe('Entity Type Detection', () => {
    beforeEach(() => {
      // Set up some schema types for testing
      const dataScriptSchema = {
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' },
        ':project/title': { ':db/valueType': ':db.type/string' },
        ':project/owner': { ':db/valueType': ':db.type/ref' }
      };
      
      factory.analyzeSchema(dataScriptSchema, 'datascript');
    });

    test('should detect entity type from attributes', () => {
      const userData = {
        ':user/name': 'John Doe',
        ':user/email': 'john@example.com'
      };

      const type = factory.detectEntityType(userData);
      expect(type).toBe('user');
    });

    test('should handle mixed attribute types', () => {
      const mixedData = {
        ':user/name': 'John Doe',
        ':project/title': 'My Project'
      };

      const type = factory.detectEntityType(mixedData);
      // Should return type with most matches (tie, but deterministic)
      expect(['user', 'project']).toContain(type);
    });

    test('should return null for unknown entity data', () => {
      const unknownData = {
        ':unknown/attr': 'value'
      };

      const type = factory.detectEntityType(unknownData);
      expect(type).toBeNull();
    });

    test('should handle null/invalid input', () => {
      expect(factory.detectEntityType(null)).toBeNull();
      expect(factory.detectEntityType('string')).toBeNull();
      expect(factory.detectEntityType(123)).toBeNull();
    });
  });

  describe('Prototype Manufacturing', () => {
    beforeEach(() => {
      // Set up schema for testing
      const dataScriptSchema = {
        ':user/name': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/one' },
        ':user/email': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/one' },
        ':user/tags': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/many' },
        ':user/active': { ':db/valueType': ':db.type/boolean', ':db/cardinality': ':db.cardinality/one' }
      };
      
      factory.analyzeSchema(dataScriptSchema, 'datascript');
      factory.baseHandleClass = Handle;
    });

    test('should require base Handle class', () => {
      const factoryWithoutBase = new PrototypeFactory();
      expect(() => factoryWithoutBase.getEntityPrototype('user')).toThrow('No base Handle class available');
    });

    test('should create and cache prototypes', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      
      expect(typeof UserPrototype).toBe('function');
      expect(UserPrototype.prototype).toBeInstanceOf(Handle);
      expect(factory.entityPrototypes.size).toBe(1);
      
      // Should return cached version on second call
      const CachedUserPrototype = factory.getEntityPrototype('user');
      expect(CachedUserPrototype).toBe(UserPrototype);
    });

    test('should return base class for unknown types', () => {
      const UnknownPrototype = factory.getEntityPrototype('unknown');
      expect(UnknownPrototype).toBe(Handle);
    });

    test('should create typed instances with correct methods', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      expect(userInstance).toBeInstanceOf(Handle);
      expect(userInstance.entityId).toBe(123);
      expect(userInstance.typeName).toBe('user');
      expect(typeof userInstance.getAvailableAttributes).toBe('function');
      expect(typeof userInstance.getRelationships).toBe('function');
      expect(typeof userInstance.getCapabilities).toBe('function');
    });

    test('should provide available attributes', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      const attributes = userInstance.getAvailableAttributes();
      expect(attributes).toContain('name');
      expect(attributes).toContain('email');
      expect(attributes).toContain('tags');
      expect(attributes).toContain('active');
    });

    test('should provide capabilities', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      const capabilities = userInstance.getCapabilities();
      expect(capabilities).toContain('query');
      expect(capabilities).toContain('value');
      expect(capabilities).toContain('subscribe');
      expect(capabilities).toContain('introspect');
    });

    test('should create dynamic property accessors', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      // Mock query response for getting name
      mockDataSource.query.mockReturnValue([['John Doe']]);
      
      // Test getter
      const name = userInstance.name;
      expect(name).toBe('John Doe');
      expect(mockDataSource.query).toHaveBeenCalledWith({
        find: ['?value'],
        where: [[123, ':user/name', '?value']]
      });
    });

    test('should handle cardinality many attributes', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      // Mock query response for getting tags (many)
      mockDataSource.query.mockReturnValue([['tag1'], ['tag2'], ['tag3']]);
      
      const tags = userInstance.tags;
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('should create dynamic property setters', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      userInstance.name = 'Jane Doe';
      
      expect(mockDataSource.update).toHaveBeenCalledWith({
        entityId: 123,
        attribute: ':user/name',
        value: 'Jane Doe'
      });
    });

    test('should validate attribute types on set', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      // Should reject wrong type
      expect(() => {
        userInstance.active = 'not-boolean'; // active is boolean type
      }).toThrow('Attribute validation failed');
    });

    test('should provide attribute validation', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      const validResult = userInstance.validateAttribute('name', 'John Doe');
      expect(validResult.valid).toBe(true);
      
      const invalidResult = userInstance.validateAttribute('name', 123);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Expected string');
      
      const unknownResult = userInstance.validateAttribute('unknown', 'value');
      expect(unknownResult.valid).toBe(false);
      expect(unknownResult.error).toContain('Unknown attribute');
    });

    test('should provide attribute information', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      const nameInfo = userInstance.getAttributeInfo('name');
      expect(nameInfo).toEqual({
        name: 'name',
        fullName: ':user/name',
        type: 'string',
        cardinality: 'one',
        required: false,
        description: undefined
      });
      
      expect(userInstance.getAttributeInfo('unknown')).toBeNull();
    });

    test('should enhance introspection with type info', () => {
      const UserPrototype = factory.getEntityPrototype('user');
      const userInstance = new UserPrototype(mockDataSource, 123);
      
      const info = userInstance.getIntrospectionInfo();
      
      expect(info.entityType).toBe('user');
      expect(info.entityId).toBe(123);
      expect(info.availableAttributes).toContain('name');
      expect(info.capabilities).toContain('query');
      expect(info.typeInfo.name).toBe('user');
      expect(info.typeInfo.attributeCount).toBe(4);
    });

    test('should avoid reserved property conflicts', () => {
      // Create schema with potentially conflicting attribute names
      const conflictSchema = {
        ':test/query': { ':db/valueType': ':db.type/string' },
        ':test/value': { ':db/valueType': ':db.type/string' },
        ':test/destroy': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(conflictSchema, 'datascript');
      
      const TestPrototype = factory.getEntityPrototype('test');
      const testInstance = new TestPrototype(mockDataSource, 123);
      
      // Should not create properties that conflict with Handle methods
      expect(testInstance.hasOwnProperty('query')).toBe(false);
      expect(testInstance.hasOwnProperty('value')).toBe(false);
      expect(testInstance.hasOwnProperty('destroy')).toBe(false);
      
      // But original Handle methods should still work
      expect(typeof testInstance.query).toBe('function');
      expect(typeof testInstance.destroy).toBe('function');
    });

    test('should handle different base classes', () => {
      class CustomHandle extends Handle {
        customMethod() {
          return 'custom';
        }
      }
      
      const CustomPrototype = factory.getEntityPrototype('user', CustomHandle);
      const customInstance = new CustomPrototype(mockDataSource, 123);
      
      expect(customInstance).toBeInstanceOf(CustomHandle);
      expect(customInstance.customMethod()).toBe('custom');
      expect(customInstance.typeName).toBe('user');
    });
  });

  describe('Cache Management', () => {
    test('should provide statistics', () => {
      factory.analyzeSchema({
        ':user/name': { ':db/valueType': ':db.type/string' }
      }, 'datascript');
      
      factory.baseHandleClass = Handle;
      factory.getEntityPrototype('user');
      
      const stats = factory.getStats();
      
      expect(stats.entityPrototypes).toBe(1);
      expect(stats.schemaTypes).toBe(1);
      expect(stats.schemaAdapters).toBeGreaterThan(0);
    });

    test('should clear cache', () => {
      factory.analyzeSchema({
        ':user/name': { ':db/valueType': ':db.type/string' }
      }, 'datascript');
      
      factory.baseHandleClass = Handle;
      factory.getEntityPrototype('user');
      
      expect(factory.entityPrototypes.size).toBe(1);
      
      factory.clearCache();
      
      expect(factory.entityPrototypes.size).toBe(0);
      expect(factory.collectionPrototypes.size).toBe(0);
      expect(factory.streamPrototypes.size).toBe(0);
    });
  });

  describe('Schema Adapter Registration', () => {
    test('should register custom schema adapter', () => {
      const analyzeFn = createMockFunction();
      analyzeFn.mockReturnValue({
        types: new Map(),
        relationships: new Map(),
        capabilities: new Map()
      });
      
      const customAdapter = {
        analyze: analyzeFn
      };
      
      factory.registerSchemaAdapter('custom', customAdapter);
      
      expect(factory.schemaAdapters.has('custom')).toBe(true);
      
      factory.analyzeSchema({ custom: true }, 'custom');
      
      expect(analyzeFn.calls.length).toBe(1);
      expect(analyzeFn.calls[0]).toEqual([{ custom: true }]);
    });

    test('should reject invalid adapters', () => {
      expect(() => factory.registerSchemaAdapter('invalid', {})).toThrow('Schema adapter must have an analyze(schema) method');
      expect(() => factory.registerSchemaAdapter('invalid', null)).toThrow('Schema adapter must have an analyze(schema) method');
    });
  });

  describe('Private Methods', () => {
    test('should convert attribute names to property names', () => {
      expect(factory._toPropertyName('user-name')).toBe('userName');
      expect(factory._toPropertyName('user_name')).toBe('userName');
      expect(factory._toPropertyName('userName')).toBe('userName');
      expect(factory._toPropertyName('simple')).toBe('simple');
    });

    test('should identify reserved properties', () => {
      expect(factory._isReservedProperty('query')).toBe(true);
      expect(factory._isReservedProperty('value')).toBe(true);
      expect(factory._isReservedProperty('destroy')).toBe(true);
      expect(factory._isReservedProperty('subscribe')).toBe(true);
      expect(factory._isReservedProperty('customProp')).toBe(false);
    });

    test('should match attributes to types', () => {
      const dataScriptMatch = factory._matchAttributeToType(':user/name', 'user');
      expect(dataScriptMatch.confidence).toBe(1.0);
      
      const prefixMatch = factory._matchAttributeToType('userName', 'user');
      expect(prefixMatch.confidence).toBe(0.7);
      
      const suffixMatch = factory._matchAttributeToType('nameUser', 'user');
      expect(suffixMatch.confidence).toBe(0.5);
      
      const noMatch = factory._matchAttributeToType('projectTitle', 'user');
      expect(noMatch).toBeNull();
    });
  });
});

// Mock Handle class for testing
class MockHandle extends Handle {
  value() {
    return 'mock-value';
  }
  
  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
}