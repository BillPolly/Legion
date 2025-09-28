/**
 * Integration tests for SchemaHandle with DataSource.getSchema()
 * 
 * Tests the integration point between SchemaHandle and DataSource,
 * specifically the fromDataSource() static method that creates
 * SchemaHandles from DataSource schemas.
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';
import { Handle } from '../../src/Handle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';

describe('SchemaHandle DataSource Integration', () => {
  // Initialize introspection system once before all tests
  beforeAll(async () => {
    await Handle.initializeIntrospection();
  });
  
  describe('fromDataSource() static method', () => {
    it('should create SchemaHandle from DataSource with schema', () => {
      // Create a mock DataSource with getSchema()
      const mockDataSource = {
        getSchema() {
          return {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' }
            },
            required: ['id', 'name']
          };
        },
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
      };
      
      // Create SchemaHandle from DataSource
      const schemaHandle = SchemaHandle.fromDataSource(mockDataSource);
      
      expect(schemaHandle).toBeInstanceOf(SchemaHandle);
      expect(schemaHandle.getSchema()).toBeDefined();
      expect(schemaHandle.getSchema().properties).toBeDefined();
      expect(schemaHandle.getSchema().properties.email.format).toBe('email');
    });
    
    it('should pass options to SchemaHandle constructor', () => {
      const mockDataSource = {
        getSchema() {
          return {
            type: 'object',
            properties: {
              id: { type: 'string' }
            }
          };
        },
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
      };
      
      const schemaHandle = SchemaHandle.fromDataSource(mockDataSource, {
        format: 'json-schema'
      });
      
      expect(schemaHandle.getFormat()).toBe('json-schema');
    });
    
    it('should throw error if DataSource lacks getSchema() method', () => {
      const invalidDataSource = {
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
        // No getSchema() method
      };
      
      expect(() => {
        SchemaHandle.fromDataSource(invalidDataSource);
      }).toThrow('DataSource must have getSchema() method');
    });
    
    it('should throw error if DataSource.getSchema() returns null', () => {
      const nullSchemaDataSource = {
        getSchema() {
          return null;
        },
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
      };
      
      expect(() => {
        SchemaHandle.fromDataSource(nullSchemaDataSource);
      }).toThrow('DataSource returned null or undefined schema');
    });
    
    it('should throw error if DataSource.getSchema() returns undefined', () => {
      const undefinedSchemaDataSource = {
        getSchema() {
          return undefined;
        },
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
      };
      
      expect(() => {
        SchemaHandle.fromDataSource(undefinedSchemaDataSource);
      }).toThrow('DataSource returned null or undefined schema');
    });
    
    it('should throw error if null DataSource provided', () => {
      expect(() => {
        SchemaHandle.fromDataSource(null);
      }).toThrow('DataSource must have getSchema() method');
    });
    
    it('should throw error if undefined DataSource provided', () => {
      expect(() => {
        SchemaHandle.fromDataSource(undefined);
      }).toThrow('DataSource must have getSchema() method');
    });
  });
  
  describe('Integration with SimpleObjectDataSource', () => {
    it('should create SchemaHandle from SimpleObjectDataSource', () => {
      // Create a SimpleObjectDataSource with explicit schema
      const dataSource = new SimpleObjectDataSource({
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      });
      
      // Override getSchema to return a proper schema
      dataSource.getSchema = function() {
        return {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' }
          },
          required: ['id', 'name']
        };
      };
      
      // Create SchemaHandle from DataSource
      const schemaHandle = SchemaHandle.fromDataSource(dataSource);
      
      expect(schemaHandle).toBeInstanceOf(SchemaHandle);
      
      // Verify schema structure
      const schema = schemaHandle.getSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties.id.type).toBe('number');
      expect(schema.properties.name.type).toBe('string');
      expect(schema.properties.email.format).toBe('email');
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
    });
    
    it('should query schema through SchemaHandle created from DataSource', () => {
      const dataSource = new SimpleObjectDataSource({});
      
      // Override getSchema with a richer schema
      dataSource.getSchema = function() {
        return {
          type: 'object',
          title: 'User Schema',
          description: 'Schema for user entities',
          properties: {
            id: { type: 'string', description: 'Unique identifier' },
            name: { type: 'string', minLength: 1, maxLength: 100 },
            email: { type: 'string', format: 'email' },
            age: { type: 'number', minimum: 0, maximum: 150 },
            roles: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['id', 'name', 'email']
        };
      };
      
      const schemaHandle = SchemaHandle.fromDataSource(dataSource);
      
      // Query schema metadata
      const metadata = schemaHandle.query({ type: 'schema-metadata' });
      expect(metadata).toBeDefined();
      expect(metadata.format).toBe('json-schema'); // Auto-detected format
      expect(metadata.title).toBe('User Schema');
      expect(metadata.description).toBe('Schema for user entities');
      
      // Query required properties
      const required = schemaHandle.query({ type: 'required-properties' });
      expect(required).toContain('id');
      expect(required).toContain('name');
      expect(required).toContain('email');
      expect(required).not.toContain('age');
    });
  });
  
  describe('Validation through SchemaHandle from DataSource', () => {
    it('should validate data using schema from DataSource', () => {
      const dataSource = {
        getSchema() {
          return {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' }
            },
            required: ['id', 'name']
          };
        },
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
      };
      
      const schemaHandle = SchemaHandle.fromDataSource(dataSource);
      
      // Valid data
      const validResult = schemaHandle.validate({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      });
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      // Invalid data - missing required field
      const invalidResult = schemaHandle.validate({
        id: 1
        // Missing required 'name' field
      });
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      
      // Check if name is mentioned in one of the errors
      const nameError = invalidResult.errors.find(e => 
        e.message && e.message.includes('name')
      );
      expect(nameError).toBeDefined();
    });
  });
  
  describe('Schema Evolution', () => {
    it('should reflect schema changes when DataSource schema changes', () => {
      let version = 1;
      
      const evolutionDataSource = {
        getSchema() {
          if (version === 1) {
            return {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            };
          } else {
            return {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },  // New field
                age: { type: 'number' }     // New field
              }
            };
          }
        },
        query: () => [],
        subscribe: () => ({ unsubscribe: () => {} }),
        queryBuilder: () => ({})
      };
      
      // Create SchemaHandle with version 1 schema
      const schemaHandle1 = SchemaHandle.fromDataSource(evolutionDataSource);
      const schema1 = schemaHandle1.getSchema();
      expect(Object.keys(schema1.properties)).toHaveLength(2);
      expect(schema1.properties.email).toBeUndefined();
      
      // Update to version 2
      version = 2;
      
      // Create new SchemaHandle with version 2 schema
      const schemaHandle2 = SchemaHandle.fromDataSource(evolutionDataSource);
      const schema2 = schemaHandle2.getSchema();
      expect(Object.keys(schema2.properties)).toHaveLength(4);
      expect(schema2.properties.email).toBeDefined();
      expect(schema2.properties.age).toBeDefined();
    });
  });
});