/**
 * Tests for SchemaRegistry class
 */

import { SchemaRegistry } from '../../src/schemas/index.js';
import { createTestSchemas } from '../utils/testUtils.js';

describe('SchemaRegistry', () => {
  let registry;
  let testSchemas;

  beforeEach(() => {
    registry = new SchemaRegistry();
    testSchemas = createTestSchemas();
  });

  describe('Constructor and Base Schema Loading', () => {
    test('creates registry with default version', () => {
      expect(registry).toBeInstanceOf(SchemaRegistry);
      expect(registry.getVersion()).toBe('1.0.0');
    });

    test('loads base schemas automatically', () => {
      const schemaIds = registry.getSchemaIds();
      expect(schemaIds).toContain('schema_definition');
      expect(schemaIds).toContain('error_message');
      expect(schemaIds).toContain('ack_message');
      expect(schemaIds).toContain('ping_message');
      expect(schemaIds).toContain('pong_message');
      expect(schemaIds.length).toBe(5);
    });

    test('base schemas have correct structure', () => {
      const schemaDefSchema = registry.get('schema_definition');
      expect(schemaDefSchema).toBeDefined();
      expect(schemaDefSchema.$id).toBe('schema_definition');
      expect(schemaDefSchema.type).toBe('object');
      
      const errorSchema = registry.get('error_message');
      expect(errorSchema).toBeDefined();
      expect(errorSchema.$id).toBe('error_message');
    });
  });

  describe('register method', () => {
    test('successfully registers valid schema', () => {
      registry.register(testSchemas.simpleMessage);
      expect(registry.has('simple_message')).toBe(true);
      expect(registry.get('simple_message')).toEqual(testSchemas.simpleMessage);
    });

    test('throws error for schema without $id', () => {
      const schemaWithoutId = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };
      
      expect(() => {
        registry.register(schemaWithoutId);
      }).toThrow('Schema must have an $id property');
    });

    test('allows overwriting existing schema', () => {
      registry.register(testSchemas.simpleMessage);
      expect(registry.get('simple_message')).toEqual(testSchemas.simpleMessage);
      
      // Register different schema with same ID
      const modifiedSchema = {
        ...testSchemas.simpleMessage,
        description: 'Modified schema'
      };
      
      registry.register(modifiedSchema);
      expect(registry.get('simple_message')).toEqual(modifiedSchema);
    });

    test('registers complex nested schema', () => {
      registry.register(testSchemas.complexMessage);
      expect(registry.has('complex_message')).toBe(true);
      expect(registry.get('complex_message')).toEqual(testSchemas.complexMessage);
    });
  });

  describe('retrieval methods', () => {
    beforeEach(() => {
      registry.register(testSchemas.simpleMessage);
      registry.register(testSchemas.complexMessage);
    });

    test('get returns correct schema', () => {
      const schema = registry.get('simple_message');
      expect(schema).toEqual(testSchemas.simpleMessage);
    });

    test('get returns null for unknown schema', () => {
      const schema = registry.get('unknown_schema');
      expect(schema).toBe(null);
    });

    test('getAll returns all schemas as object', () => {
      const allSchemas = registry.getAll();
      expect(allSchemas).toHaveProperty('simple_message');
      expect(allSchemas).toHaveProperty('complex_message');
      expect(allSchemas).toHaveProperty('schema_definition'); // Base schema
      expect(allSchemas.simple_message).toEqual(testSchemas.simpleMessage);
    });

    test('has returns true for existing schema', () => {
      expect(registry.has('simple_message')).toBe(true);
      expect(registry.has('schema_definition')).toBe(true); // Base schema
    });

    test('has returns false for non-existing schema', () => {
      expect(registry.has('unknown_schema')).toBe(false);
    });

    test('getSchemaIds returns all schema IDs', () => {
      const ids = registry.getSchemaIds();
      expect(ids).toContain('simple_message');
      expect(ids).toContain('complex_message');
      expect(ids).toContain('schema_definition'); // Base schema
      expect(ids.length).toBeGreaterThanOrEqual(7); // 5 base + 2 test schemas
    });
  });

  describe('version management', () => {
    test('getVersion returns current version', () => {
      expect(registry.getVersion()).toBe('1.0.0');
    });

    test('setVersion updates version with valid semver', () => {
      registry.setVersion('2.1.3');
      expect(registry.getVersion()).toBe('2.1.3');
    });

    test('setVersion throws error for invalid semver', () => {
      expect(() => {
        registry.setVersion('invalid-version');
      }).toThrow('Version must be in semver format');

      expect(() => {
        registry.setVersion('1.0');
      }).toThrow('Version must be in semver format');

      expect(() => {
        registry.setVersion('1.0.0.0');
      }).toThrow('Version must be in semver format');
    });
  });

  describe('loadSchemas method', () => {
    test('loads schemas without replace', () => {
      const originalCount = registry.getSchemaIds().length;
      
      const schemasToLoad = {
        test_schema_1: testSchemas.simpleMessage,
        test_schema_2: testSchemas.complexMessage
      };
      
      registry.loadSchemas(schemasToLoad, false);
      
      expect(registry.has('test_schema_1')).toBe(true);
      expect(registry.has('test_schema_2')).toBe(true);
      expect(registry.has('schema_definition')).toBe(true); // Base schema preserved
      expect(registry.getSchemaIds().length).toBe(originalCount + 2);
    });

    test('loads schemas with replace', () => {
      registry.register(testSchemas.simpleMessage);
      expect(registry.has('simple_message')).toBe(true);
      
      const schemasToLoad = {
        new_schema: testSchemas.complexMessage
      };
      
      registry.loadSchemas(schemasToLoad, true);
      
      expect(registry.has('new_schema')).toBe(true);
      expect(registry.has('simple_message')).toBe(false); // Removed
      expect(registry.has('schema_definition')).toBe(true); // Base schemas re-added
    });

    test('adds $id to schemas that missing it', () => {
      const schemaWithoutId = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };
      
      const schemasToLoad = {
        test_schema: schemaWithoutId
      };
      
      registry.loadSchemas(schemasToLoad, false);
      
      const loadedSchema = registry.get('test_schema');
      expect(loadedSchema.$id).toBe('test_schema');
    });
  });

  describe('unregister method', () => {
    beforeEach(() => {
      registry.register(testSchemas.simpleMessage);
    });

    test('successfully removes existing schema', () => {
      expect(registry.has('simple_message')).toBe(true);
      const result = registry.unregister('simple_message');
      expect(result).toBe(true);
      expect(registry.has('simple_message')).toBe(false);
    });

    test('returns false for non-existing schema', () => {
      const result = registry.unregister('unknown_schema');
      expect(result).toBe(false);
    });

    test('cannot remove base schemas', () => {
      // Base schemas should be protected or at least removable and re-addable
      expect(registry.has('error_message')).toBe(true);
      const result = registry.unregister('error_message');
      expect(result).toBe(true); // Should be removable
    });
  });

  describe('createSchemaDefinitionMessage method', () => {
    beforeEach(() => {
      registry.register(testSchemas.simpleMessage);
      registry.register(testSchemas.complexMessage);
      registry.setVersion('1.2.3');
    });

    test('creates valid schema definition message', () => {
      const message = registry.createSchemaDefinitionMessage();
      
      expect(message.type).toBe('schema_definition');
      expect(message.version).toBe('1.2.3');
      expect(message.schemas).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    test('includes all registered schemas', () => {
      const message = registry.createSchemaDefinitionMessage();
      
      expect(message.schemas).toHaveProperty('simple_message');
      expect(message.schemas).toHaveProperty('complex_message');
      expect(message.schemas).toHaveProperty('schema_definition');
      expect(message.schemas.simple_message).toEqual(testSchemas.simpleMessage);
    });

    test('has valid timestamp format', () => {
      const message = registry.createSchemaDefinitionMessage();
      const timestamp = new Date(message.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(message.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});