/**
 * Unit tests for schema discovery and validation operations
 * Tests schema utilities and DataSource schema methods
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';
import { 
  validateAgainstSchema, 
  validateMongoDocument,
  mergeSchemas
} from '../../src/utils/schemaValidation.js';

describe('MongoDBDataSource - Schema Operations', () => {
  let dataSource;
  
  beforeEach(() => {
    dataSource = new MongoDBDataSource({
      connectionString: 'mongodb://localhost:27017'
    });
  });
  
  describe('getSchema() method', () => {
    it('should return schema synchronously', () => {
      const schema = dataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('mongodb');
      expect(schema.version).toBe('6.0.0');
      expect(schema.capabilities).toBeDefined();
    });
    
    it('should include capabilities in schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.capabilities.transactions).toBe(true);
      expect(schema.capabilities.changeStreams).toBe(true);
      expect(schema.capabilities.aggregation).toBe(true);
    });
    
    it('should return cached schema if available and fresh', () => {
      // Set a cached schema
      dataSource._schemaCache = {
        type: 'mongodb',
        version: '6.0.0',
        databases: { testdb: {} },
        capabilities: { transactions: true, changeStreams: true, aggregation: true }
      };
      dataSource._schemaCacheTime = Date.now();
      
      const schema = dataSource.getSchema();
      
      expect(schema).toBe(dataSource._schemaCache);
      expect(schema.databases).toEqual({ testdb: {} });
    });
    
    it('should not return cached schema if stale', () => {
      // Set a stale cached schema
      dataSource._schemaCache = {
        type: 'mongodb',
        version: '6.0.0',
        databases: { testdb: {} },
        capabilities: { transactions: true, changeStreams: true, aggregation: true }
      };
      dataSource._schemaCacheTime = Date.now() - (dataSource._schemaCacheTTL + 1000);
      
      const schema = dataSource.getSchema();
      
      // Should return basic schema, not cached one
      expect(schema.databases).toEqual({});
      expect(schema.cached).toBe(false);
    });
    
    it('should indicate when schema is not cached', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.cached).toBe(false);
      expect(schema.message).toContain('discoverSchema()');
    });
  });
  
  describe('clearSchemaCache() method', () => {
    it('should clear the schema cache', () => {
      // Set a cached schema
      dataSource._schemaCache = { type: 'mongodb', version: '6.0.0' };
      dataSource._schemaCacheTime = Date.now();
      
      dataSource.clearSchemaCache();
      
      expect(dataSource._schemaCache).toBeNull();
      expect(dataSource._schemaCacheTime).toBe(0);
    });
    
    it('should force getSchema() to return basic schema after clear', () => {
      // Set a cached schema
      dataSource._schemaCache = {
        type: 'mongodb',
        version: '6.0.0',
        databases: { testdb: {} },
        capabilities: { transactions: true, changeStreams: true, aggregation: true }
      };
      dataSource._schemaCacheTime = Date.now();
      
      dataSource.clearSchemaCache();
      const schema = dataSource.getSchema();
      
      expect(schema.databases).toEqual({});
      expect(schema.cached).toBe(false);
    });
  });
  
  describe('validate() method', () => {
    it('should validate MongoDB document structure', () => {
      const validDoc = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      const result = dataSource.validate(validDoc);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject non-object documents', () => {
      const result = dataSource.validate('not an object');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('must be objects');
    });
    
    it('should reject field names starting with $', () => {
      const invalidDoc = {
        '$invalid': 'value',
        'validField': 'value'
      };
      
      const result = dataSource.validate(invalidDoc);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('cannot start with'))).toBe(true);
    });
    
    it('should reject field names containing dots', () => {
      const invalidDoc = {
        'field.with.dots': 'value',
        'validField': 'value'
      };
      
      const result = dataSource.validate(invalidDoc);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('cannot contain'))).toBe(true);
    });
    
    it('should validate against cached schema if available', () => {
      // Set a cached schema with required field
      dataSource._schemaCache = {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' }
          },
          required: ['name', 'email']
        }
      };
      
      const invalidDoc = {
        name: 'John Doe'
        // Missing required 'email' field
      };
      
      const result = dataSource.validate(invalidDoc);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Required field'))).toBe(true);
    });
    
    it('should skip schema validation if useSchema is false', () => {
      // Set a cached schema with required field
      dataSource._schemaCache = {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        }
      };
      
      const invalidDoc = {
        // Missing required 'name' field
      };
      
      const result = dataSource.validate(invalidDoc, { useSchema: false });
      
      // Should pass because schema validation is skipped
      expect(result.valid).toBe(true);
    });
    
    it('should skip document validation if validateDocument is false', () => {
      const invalidDoc = {
        '$invalidField': 'value'
      };
      
      const result = dataSource.validate(invalidDoc, { validateDocument: false });
      
      // Should pass because document validation is skipped
      expect(result.valid).toBe(true);
    });
  });
  
  describe('validateAgainstCustomSchema() method', () => {
    it('should validate data against custom schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      
      const validData = {
        name: 'John',
        age: 30
      };
      
      const result = dataSource.validateAgainstCustomSchema(validData, schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect type mismatches', () => {
      const schema = {
        type: 'object',
        properties: {
          age: { type: 'number' }
        }
      };
      
      const invalidData = {
        age: 'not a number'
      };
      
      const result = dataSource.validateAgainstCustomSchema(invalidData, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Expected number'))).toBe(true);
    });
    
    it('should detect missing required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };
      
      const invalidData = {
        // Missing 'name'
      };
      
      const result = dataSource.validateAgainstCustomSchema(invalidData, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Required field'))).toBe(true);
    });
  });
});

describe('Schema Validation Utilities', () => {
  describe('validateAgainstSchema()', () => {
    it('should validate string types', () => {
      const schema = { type: 'string' };
      const result = validateAgainstSchema('hello', schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate number types', () => {
      const schema = { type: 'number' };
      const result = validateAgainstSchema(42, schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate boolean types', () => {
      const schema = { type: 'boolean' };
      const result = validateAgainstSchema(true, schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate array types', () => {
      const schema = { type: 'array' };
      const result = validateAgainstSchema([1, 2, 3], schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate object types', () => {
      const schema = { type: 'object' };
      const result = validateAgainstSchema({ key: 'value' }, schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' }
      };
      
      const result = validateAgainstSchema([1, 2, 3], schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should detect invalid array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' }
      };
      
      const result = validateAgainstSchema([1, 'two', 3], schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('[1]'))).toBe(true);
    });
    
    it('should validate string length constraints', () => {
      const schema = {
        type: 'string',
        minLength: 3,
        maxLength: 10
      };
      
      const result = validateAgainstSchema('hello', schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should detect string too short', () => {
      const schema = {
        type: 'string',
        minLength: 5
      };
      
      const result = validateAgainstSchema('hi', schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('less than minimum');
    });
    
    it('should validate number constraints', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };
      
      const result = validateAgainstSchema(50, schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should detect number below minimum', () => {
      const schema = {
        type: 'number',
        minimum: 10
      };
      
      const result = validateAgainstSchema(5, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('less than minimum');
    });
    
    it('should validate email format', () => {
      const schema = {
        type: 'string',
        format: 'email'
      };
      
      const result = validateAgainstSchema('test@example.com', schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should detect invalid email format', () => {
      const schema = {
        type: 'string',
        format: 'email'
      };
      
      const result = validateAgainstSchema('not-an-email', schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid email');
    });
    
    it('should validate objectid format', () => {
      const schema = {
        type: 'string',
        format: 'objectid'
      };
      
      const result = validateAgainstSchema('507f1f77bcf86cd799439011', schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should detect invalid objectid format', () => {
      const schema = {
        type: 'string',
        format: 'objectid'
      };
      
      const result = validateAgainstSchema('not-an-objectid', schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid ObjectId');
    });
  });
  
  describe('validateMongoDocument()', () => {
    it('should accept valid documents', () => {
      const doc = {
        name: 'John',
        age: 30,
        nested: {
          field: 'value'
        }
      };
      
      const result = validateMongoDocument(doc);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject non-objects', () => {
      const result = validateMongoDocument('not an object');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must be objects');
    });
    
    it('should reject field names starting with $', () => {
      const doc = {
        '$set': 'value'
      };
      
      const result = validateMongoDocument(doc);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('cannot start with');
    });
    
    it('should reject field names with dots', () => {
      const doc = {
        'field.name': 'value'
      };
      
      const result = validateMongoDocument(doc);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('cannot contain');
    });
  });
  
  describe('mergeSchemas()', () => {
    it('should merge schemas with common fields', () => {
      const schema1 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      
      const schema2 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['name']
      };
      
      const merged = mergeSchemas([schema1, schema2]);
      
      expect(merged.properties.name).toBeDefined();
      expect(merged.properties.age).toBeDefined();
      expect(merged.properties.email).toBeDefined();
    });
    
    it('should handle schemas with different types for same field', () => {
      const schema1 = {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      };
      
      const schema2 = {
        type: 'object',
        properties: {
          value: { type: 'number' }
        }
      };
      
      const merged = mergeSchemas([schema1, schema2]);
      
      expect(merged.properties.value.oneOf).toBeDefined();
      expect(merged.properties.value.oneOf.length).toBe(2);
    });
    
    it('should return single schema if only one provided', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      
      const merged = mergeSchemas([schema]);
      
      expect(merged).toEqual(schema);
    });
    
    it('should return empty schema for empty array', () => {
      const merged = mergeSchemas([]);
      
      expect(merged.type).toBe('object');
      expect(merged.properties).toEqual({});
    });
  });
});