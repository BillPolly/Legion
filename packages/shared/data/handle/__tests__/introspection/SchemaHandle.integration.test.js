/**
 * Integration tests for SchemaHandle
 * 
 * Tests the complete workflow of schema introspection and manipulation:
 * - Loading real schemas (JSON Schema, custom formats)
 * - Querying schema structure
 * - Validating data against schemas
 * - Modifying schemas dynamically
 * - Subscribing to schema changes
 * - Converting between schema formats
 * 
 * These tests verify SchemaHandle works correctly in realistic scenarios
 * with complex schemas and real data.
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';

describe('SchemaHandle Integration Tests', () => {
  describe('Real-world JSON Schema Operations', () => {
    let userSchema;
    
    beforeEach(() => {
      // Real-world user schema with complex structure
      userSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'http://example.com/schemas/user.json',
        type: 'object',
        title: 'User',
        description: 'A user in the system',
        version: '2.0.0',
        definitions: {
          Address: {
            type: 'object',
            properties: {
              street: { type: 'string', minLength: 1 },
              city: { type: 'string', minLength: 1 },
              state: { type: 'string', pattern: '^[A-Z]{2}$' },
              zipCode: { type: 'string', pattern: '^\\d{5}(-\\d{4})?$' },
              country: { type: 'string', default: 'US' }
            },
            required: ['street', 'city', 'state', 'zipCode']
          },
          Contact: {
            type: 'object',
            properties: {
              phone: { type: 'string', pattern: '^\\d{3}-\\d{3}-\\d{4}$' },
              email: { type: 'string', format: 'email' },
              website: { type: 'string', format: 'uri' }
            },
            required: ['email']
          }
        },
        properties: {
          id: { type: 'integer', minimum: 1 },
          username: { 
            type: 'string', 
            minLength: 3, 
            maxLength: 20,
            pattern: '^[a-zA-Z0-9_]+$'
          },
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          isActive: { type: 'boolean', default: true },
          roles: { 
            type: 'array', 
            items: { type: 'string' },
            minItems: 1,
            uniqueItems: true
          },
          metadata: {
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['id', 'username', 'email', 'roles']
      };
    });
    
    it('should load and query complex JSON Schema', () => {
      const handle = new SchemaHandle(userSchema);
      
      // Verify basic properties
      expect(handle.getSchema()).toBe(userSchema);
      expect(handle.getFormat()).toBe('json-schema');
      
      // Query schema structure
      const properties = handle.getProperties();
      expect(properties.length).toBeGreaterThan(0);
      
      const usernameProperty = properties.find(p => p.name === 'username');
      expect(usernameProperty).toBeDefined();
      expect(usernameProperty.type).toBe('string');
      expect(usernameProperty.schema.minLength).toBe(3);
      expect(usernameProperty.schema.maxLength).toBe(20);
    });
    
    it('should validate valid user data', () => {
      const handle = new SchemaHandle(userSchema);
      
      const validUser = {
        id: 123,
        username: 'john_doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        roles: ['user', 'admin'],
        metadata: {
          lastLogin: '2024-01-15',
          preferences: { theme: 'dark' }
        }
      };
      
      const result = handle.validate(validUser);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect validation errors in user data', () => {
      const handle = new SchemaHandle(userSchema);
      
      const invalidUser = {
        id: 123,
        username: 'ab', // Too short (minLength: 3)
        email: 'not-an-email', // Invalid email format
        age: 200, // Exceeds maximum
        roles: [] // Empty array (minItems: 1)
      };
      
      const result = handle.validate(invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should have errors for username length, email format, age maximum, and roles minItems
      const errorTypes = result.errors.map(e => e.field || e.path);
      expect(errorTypes).toContain('username');
      expect(errorTypes).toContain('email');
      expect(errorTypes).toContain('age');
    });
    
    it('should handle entity types from definitions', () => {
      const handle = new SchemaHandle(userSchema);
      
      const entityTypes = handle.getEntityTypes();
      expect(entityTypes).toContain('Address');
      expect(entityTypes).toContain('Contact');
      
      expect(handle.hasEntityType('Address')).toBe(true);
      expect(handle.hasEntityType('Contact')).toBe(true);
      expect(handle.hasEntityType('NonExistent')).toBe(false);
    });
    
    it('should query properties of nested entity types', () => {
      const handle = new SchemaHandle(userSchema);
      
      const addressProperties = handle.getProperties('Address');
      expect(addressProperties.length).toBe(5);
      
      const streetProperty = addressProperties.find(p => p.name === 'street');
      expect(streetProperty).toBeDefined();
      expect(streetProperty.type).toBe('string');
      expect(streetProperty.required).toBe(true);
      
      const countryProperty = addressProperties.find(p => p.name === 'country');
      expect(countryProperty).toBeDefined();
      expect(countryProperty.schema.default).toBe('US');
    });
  });
  
  describe('Schema Modification Workflows', () => {
    it('should add and remove properties dynamically', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      
      const handle = new SchemaHandle(schema);
      
      // Add new property
      expect(handle.hasProperty(null, 'email')).toBe(false);
      handle.addProperty(null, 'email', { type: 'string', format: 'email' });
      expect(handle.hasProperty(null, 'email')).toBe(true);
      
      const emailSchema = handle.getPropertySchema(null, 'email');
      expect(emailSchema.type).toBe('string');
      expect(emailSchema.format).toBe('email');
      
      // Remove property
      handle.removeProperty(null, 'age');
      expect(handle.hasProperty(null, 'age')).toBe(false);
      expect(handle.hasProperty(null, 'name')).toBe(true);
      expect(handle.hasProperty(null, 'email')).toBe(true);
    });
    
    it('should modify existing property constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3 }
        }
      };
      
      const handle = new SchemaHandle(schema);
      
      // Verify initial state
      let usernameSchema = handle.getPropertySchema(null, 'username');
      expect(usernameSchema.minLength).toBe(3);
      expect(usernameSchema.maxLength).toBeUndefined();
      
      // Modify property
      handle.modifyProperty(null, 'username', {
        type: 'string',
        minLength: 5,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_]+$'
      });
      
      // Verify changes
      usernameSchema = handle.getPropertySchema(null, 'username');
      expect(usernameSchema.minLength).toBe(5);
      expect(usernameSchema.maxLength).toBe(20);
      expect(usernameSchema.pattern).toBe('^[a-zA-Z0-9_]+$');
    });
    
    it('should add and remove entity types', () => {
      const schema = {
        type: 'object',
        definitions: {
          User: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      };
      
      const handle = new SchemaHandle(schema);
      
      // Add new entity type
      expect(handle.hasEntityType('Product')).toBe(false);
      handle.addEntityType('Product', {
        name: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        inStock: { type: 'boolean' }
      });
      expect(handle.hasEntityType('Product')).toBe(true);
      
      const productProperties = handle.getProperties('Product');
      expect(productProperties.length).toBe(3);
      
      // Remove entity type
      handle.removeEntityType('User');
      expect(handle.hasEntityType('User')).toBe(false);
      expect(handle.hasEntityType('Product')).toBe(true);
    });
  });
  
  describe('Schema Change Subscriptions', () => {
    it('should notify subscribers when properties are added', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      
      const handle = new SchemaHandle(schema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'properties' },
        (change) => changes.push(change)
      );
      
      // Add property - should trigger notification
      handle.addProperty(null, 'email', { type: 'string' });
      
      expect(changes.length).toBeGreaterThan(0);
      
      subscription.unsubscribe();
    });
    
    it('should notify subscribers when constraints are modified', () => {
      const schema = {
        type: 'object',
        properties: {
          age: { type: 'number' }
        }
      };
      
      const handle = new SchemaHandle(schema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'constraints' },
        (change) => changes.push(change)
      );
      
      // Add constraint - should trigger notification
      handle.addConstraint(null, 'minimum', 0);
      handle.addConstraint(null, 'maximum', 150);
      
      expect(changes.length).toBeGreaterThan(0);
      
      subscription.unsubscribe();
    });
    
    it('should stop notifications after unsubscribe', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      
      const handle = new SchemaHandle(schema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'properties' },
        (change) => changes.push(change)
      );
      
      // Unsubscribe immediately
      subscription.unsubscribe();
      
      // Add property - should NOT trigger notification
      handle.addProperty(null, 'email', { type: 'string' });
      
      expect(changes).toHaveLength(0);
    });
  });
  
  describe('Complete Schema Lifecycle', () => {
    it('should handle complete schema creation, validation, and modification workflow', () => {
      // Start with empty schema
      const schema = {
        type: 'object',
        properties: {}
      };
      
      const handle = new SchemaHandle(schema);
      
      // Build schema incrementally
      handle.addProperty(null, 'id', { type: 'integer', minimum: 1 });
      handle.addProperty(null, 'name', { type: 'string', minLength: 1 });
      handle.addProperty(null, 'email', { type: 'string', format: 'email' });
      
      // Add constraints
      handle.addConstraint(null, 'required', ['id', 'name', 'email']);
      
      // Validate data against built schema
      const validData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      let result = handle.validate(validData);
      expect(result.isValid).toBe(true);
      
      // Invalid data should fail
      const invalidData = {
        id: -1, // Violates minimum constraint
        name: '', // Violates minLength constraint
        email: 'not-an-email' // Violates format
      };
      
      result = handle.validate(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Modify schema
      handle.modifyProperty(null, 'id', { type: 'string' }); // Change type
      
      // Now string ID should be valid
      const dataWithStringId = {
        id: 'user-123',
        name: 'Jane Doe',
        email: 'jane@example.com'
      };
      
      result = handle.validate(dataWithStringId);
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('JSON Schema Conversion', () => {
    it('should convert to JSON Schema format', () => {
      const schema = {
        type: 'object',
        title: 'Person',
        properties: {
          name: { type: 'string', minLength: 1 },
          age: { type: 'integer', minimum: 0, maximum: 150 }
        },
        required: ['name']
      };
      
      const handle = new SchemaHandle(schema);
      const jsonSchema = handle.toJSONSchema();
      
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.title).toBe('Person');
      expect(jsonSchema.properties).toBeDefined();
      expect(jsonSchema.properties.name).toBeDefined();
      expect(jsonSchema.properties.age).toBeDefined();
      expect(jsonSchema.required).toContain('name');
    });
    
    it('should preserve original schema for JSON Schema format', () => {
      const originalSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      
      const handle = new SchemaHandle(originalSchema);
      const jsonSchema = handle.toJSONSchema();
      
      // Should return the original schema object
      expect(jsonSchema).toBe(originalSchema);
    });
  });
  
  describe('Complex Validation Scenarios', () => {
    it('should validate nested object properties', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1 },
              email: { type: 'string', format: 'email' }
            },
            required: ['name', 'email']
          }
        }
      };
      
      const handle = new SchemaHandle(schema);
      
      const validData = {
        user: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };
      
      const result = handle.validate(validData);
      expect(result.isValid).toBe(true);
    });
    
    it('should validate array properties with constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5,
            uniqueItems: true
          }
        }
      };
      
      const handle = new SchemaHandle(schema);
      
      // Valid array
      let result = handle.validate({ tags: ['javascript', 'node', 'express'] });
      expect(result.isValid).toBe(true);
      
      // Empty array violates minItems
      result = handle.validate({ tags: [] });
      expect(result.isValid).toBe(false);
      
      // Too many items violates maxItems
      result = handle.validate({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('Schema Metadata Operations', () => {
    it('should retrieve and use schema metadata', () => {
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'http://example.com/person.json',
        type: 'object',
        title: 'Person',
        description: 'A person entity',
        version: '1.0.0',
        properties: {
          name: { type: 'string' }
        }
      };
      
      const handle = new SchemaHandle(schema);
      const metadata = handle.getMetadata();
      
      expect(metadata.title).toBe('Person');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.id).toBe('http://example.com/person.json');
      expect(metadata.schemaVersion).toBe('http://json-schema.org/draft-07/schema#');
    });
    
    it('should get validation rules from schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          age: { type: 'integer', minimum: 0, maximum: 150 }
        },
        required: ['name']
      };
      
      const handle = new SchemaHandle(schema);
      const rules = handle.getValidationRules();
      
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
      
      // Should have required rule for name
      const requiredRules = rules.filter(r => r.rule === 'required');
      expect(requiredRules.length).toBeGreaterThan(0);
    });
  });
});