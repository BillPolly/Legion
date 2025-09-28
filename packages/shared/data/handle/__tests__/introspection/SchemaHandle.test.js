/**
 * Unit tests for SchemaHandle
 * 
 * Tests schema introspection capabilities:
 * - Schema wrapping and Handle interface
 * - Query operations (entity types, properties, relationships, constraints)
 * - Update operations (add/remove properties, modify constraints)
 * - Validation operations
 * - Subscription to schema changes
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';

describe('SchemaHandle', () => {
  let simpleSchema;
  let complexSchema;
  
  beforeEach(() => {
    // Simple JSON Schema for testing
    simpleSchema = {
      type: 'object',
      title: 'Person',
      description: 'A person entity',
      properties: {
        name: { type: 'string', description: 'Person name' },
        age: { type: 'number', minimum: 0, maximum: 150 },
        email: { type: 'string', format: 'email' }
      },
      required: ['name', 'email']
    };
    
    // Complex JSON Schema with nested structures
    complexSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'http://example.com/schemas/user',
      type: 'object',
      title: 'User',
      version: '1.0.0',
      definitions: {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zipCode: { type: 'string', pattern: '^\\d{5}$' }
          },
          required: ['street', 'city']
        },
        Contact: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
        }
      },
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 20 },
        roles: { type: 'array', items: { type: 'string' } }
      },
      required: ['username']
    };
  });
  
  describe('Constructor and Basic Properties', () => {
    it('should create SchemaHandle with valid schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      expect(handle).toBeInstanceOf(SchemaHandle);
      expect(handle.getSchema()).toBe(simpleSchema);
      expect(handle.getFormat()).toBe('json-schema');
    });
    
    it('should throw error with invalid schema', () => {
      expect(() => new SchemaHandle(null)).toThrow('Schema must be a valid object');
      expect(() => new SchemaHandle('not an object')).toThrow('Schema must be a valid object');
      expect(() => new SchemaHandle(123)).toThrow('Schema must be a valid object');
    });
    
    it('should accept schema format option', () => {
      const handle = new SchemaHandle(simpleSchema, { format: 'custom' });
      expect(handle.getFormat()).toBe('custom');
    });
    
    it('should detect JSON Schema format automatically', () => {
      const handle = new SchemaHandle(simpleSchema);
      expect(handle.getFormat()).toBe('json-schema');
    });
    
    it('should have correct Handle metadata', () => {
      const handle = new SchemaHandle(simpleSchema);
      const metadata = handle.metadata;
      
      expect(metadata.handleType).toBe('schema');
      expect(metadata.schemaFormat).toBe('json-schema');
    });
  });
  
  describe('Query Operations - Entity Types', () => {
    it('should get entity types from simple schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      const entityTypes = handle.getEntityTypes();
      
      expect(Array.isArray(entityTypes)).toBe(true);
      expect(entityTypes).toContain('name');
      expect(entityTypes).toContain('age');
      expect(entityTypes).toContain('email');
    });
    
    it('should get entity types from schema with definitions', () => {
      const handle = new SchemaHandle(complexSchema);
      const entityTypes = handle.getEntityTypes();
      
      expect(Array.isArray(entityTypes)).toBe(true);
      expect(entityTypes).toContain('Address');
      expect(entityTypes).toContain('Contact');
    });
    
    it('should check if entity type exists', () => {
      const handle = new SchemaHandle(complexSchema);
      
      expect(handle.hasEntityType('Address')).toBe(true);
      expect(handle.hasEntityType('Contact')).toBe(true);
      expect(handle.hasEntityType('NonExistent')).toBe(false);
    });
  });
  
  describe('Query Operations - Properties', () => {
    it('should get properties for simple schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      const properties = handle.getProperties();
      
      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBe(3);
      
      const nameProperty = properties.find(p => p.name === 'name');
      expect(nameProperty).toBeDefined();
      expect(nameProperty.type).toBe('string');
      expect(nameProperty.required).toBe(true);
    });
    
    it('should get properties for specific entity type', () => {
      const handle = new SchemaHandle(complexSchema);
      const properties = handle.getProperties('Address');
      
      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBe(3);
      
      const streetProperty = properties.find(p => p.name === 'street');
      expect(streetProperty).toBeDefined();
      expect(streetProperty.type).toBe('string');
    });
    
    it('should check if property exists', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      expect(handle.hasProperty(null, 'name')).toBe(true);
      expect(handle.hasProperty(null, 'age')).toBe(true);
      expect(handle.hasProperty(null, 'nonExistent')).toBe(false);
    });
    
    it('should get property schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      const nameSchema = handle.getPropertySchema(null, 'name');
      
      expect(nameSchema).toBeDefined();
      expect(nameSchema.type).toBe('string');
    });
  });
  
  describe('Query Operations - Constraints', () => {
    it('should get constraints for simple schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      const constraints = handle.getConstraints();
      
      expect(typeof constraints).toBe('object');
    });
    
    it('should get property-level constraints', () => {
      const handle = new SchemaHandle(simpleSchema);
      const properties = handle.getProperties();
      
      const ageProperty = properties.find(p => p.name === 'age');
      expect(ageProperty.schema.minimum).toBe(0);
      expect(ageProperty.schema.maximum).toBe(150);
    });
    
    it('should get required properties', () => {
      const handle = new SchemaHandle(simpleSchema);
      const required = handle.getRequiredProperties();
      
      expect(Array.isArray(required)).toBe(true);
      expect(required).toContain('name');
      expect(required).toContain('email');
      expect(required).not.toContain('age');
    });
  });
  
  describe('Query Operations - Schema Metadata', () => {
    it('should get schema type', () => {
      const handle = new SchemaHandle(simpleSchema);
      const schemaType = handle.getSchemaType();
      
      expect(schemaType).toBe('object');
    });
    
    it('should get schema metadata', () => {
      const handle = new SchemaHandle(complexSchema);
      const metadata = handle.getMetadata();
      
      expect(metadata.title).toBe('User');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.id).toBe('http://example.com/schemas/user');
      expect(metadata.schemaVersion).toBe('http://json-schema.org/draft-07/schema#');
    });
    
    it('should get validation rules', () => {
      const handle = new SchemaHandle(simpleSchema);
      const rules = handle.getValidationRules();
      
      expect(Array.isArray(rules)).toBe(true);
      
      // Should have required rules for name and email
      const requiredRules = rules.filter(r => r.rule === 'required');
      expect(requiredRules.length).toBeGreaterThan(0);
    });
  });
  
  describe('Update Operations - Entity Types', () => {
    it('should add entity type to schema', () => {
      const handle = new SchemaHandle(complexSchema);
      
      const result = handle.addEntityType('Product', {
        name: { type: 'string' },
        price: { type: 'number' }
      });
      
      expect(result).toBe(true);
      expect(handle.hasEntityType('Product')).toBe(true);
    });
    
    it('should remove entity type from schema', () => {
      const handle = new SchemaHandle(complexSchema);
      
      expect(handle.hasEntityType('Address')).toBe(true);
      
      const result = handle.removeEntityType('Address');
      expect(result).toBe(true);
      expect(handle.hasEntityType('Address')).toBe(false);
    });
    
    it('should throw error when removing non-existent entity type', () => {
      const handle = new SchemaHandle(complexSchema);
      
      expect(() => handle.removeEntityType('NonExistent')).toThrow();
    });
  });
  
  describe('Update Operations - Properties', () => {
    it('should add property to schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const result = handle.addProperty(null, 'phoneNumber', { type: 'string' });
      expect(result).toBe(true);
      expect(handle.hasProperty(null, 'phoneNumber')).toBe(true);
    });
    
    it('should modify existing property', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const result = handle.modifyProperty(null, 'name', { type: 'string', minLength: 2 });
      expect(result).toBe(true);
      
      const nameSchema = handle.getPropertySchema(null, 'name');
      expect(nameSchema.minLength).toBe(2);
    });
    
    it('should remove property from schema', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      expect(handle.hasProperty(null, 'age')).toBe(true);
      
      const result = handle.removeProperty(null, 'age');
      expect(result).toBe(true);
      expect(handle.hasProperty(null, 'age')).toBe(false);
    });
    
    it('should throw error when modifying non-existent property', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      expect(() => handle.modifyProperty(null, 'nonExistent', { type: 'string' })).toThrow();
    });
  });
  
  describe('Update Operations - Relationships', () => {
    it('should add relationship between entity types', () => {
      const handle = new SchemaHandle(complexSchema);
      
      const result = handle.addRelationship('User', 'Address', 'address', 'belongsTo');
      expect(result).toBe(true);
    });
    
    it('should remove relationship between entity types', () => {
      const handle = new SchemaHandle(complexSchema);
      
      handle.addRelationship('User', 'Contact', 'contact', 'belongsTo');
      
      const result = handle.removeRelationship('User', 'Contact', 'contact');
      expect(result).toBe(true);
    });
  });
  
  describe('Update Operations - Constraints', () => {
    it('should add constraint to entity type', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const result = handle.addConstraint(null, 'minProperties', 2);
      expect(result).toBe(true);
      
      const constraints = handle.getConstraints();
      expect(constraints.minProperties).toBe(2);
    });
    
    it('should remove constraint from entity type', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      handle.addConstraint(null, 'maxProperties', 10);
      expect(handle.getConstraints().maxProperties).toBe(10);
      
      const result = handle.removeConstraint(null, 'maxProperties');
      expect(result).toBe(true);
      expect(handle.getConstraints().maxProperties).toBeUndefined();
    });
  });
  
  describe('Validation Operations', () => {
    it('should validate valid data', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };
      
      const result = handle.validate(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing required properties', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const invalidData = {
        age: 30
      };
      
      const result = handle.validate(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should detect type mismatches', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const invalidData = {
        name: 'John Doe',
        age: 'thirty', // Should be number
        email: 'john@example.com'
      };
      
      const result = handle.validate(invalidData);
      expect(result.isValid).toBe(false);
    });
    
    it('should validate constraint violations', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const invalidData = {
        name: 'John Doe',
        age: 200, // Exceeds maximum
        email: 'john@example.com'
      };
      
      const result = handle.validate(invalidData);
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('Subscription Operations', () => {
    it('should subscribe to schema changes', () => {
      const handle = new SchemaHandle(simpleSchema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'property-added' },
        (change) => changes.push(change)
      );
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      subscription.unsubscribe();
    });
    
    it('should receive notifications on property additions', () => {
      const handle = new SchemaHandle(simpleSchema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'properties' },
        (change) => changes.push(change)
      );
      
      handle.addProperty(null, 'address', { type: 'string' });
      
      expect(changes.length).toBeGreaterThan(0);
      
      subscription.unsubscribe();
    });
    
    it('should unsubscribe from schema changes', () => {
      const handle = new SchemaHandle(simpleSchema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'properties' },
        (change) => changes.push(change)
      );
      
      subscription.unsubscribe();
      
      handle.addProperty(null, 'newField', { type: 'string' });
      
      // No changes should be recorded after unsubscribe
      expect(changes).toHaveLength(0);
    });
  });
  
  describe('JSON Schema Conversion', () => {
    it('should convert to JSON Schema format', () => {
      const handle = new SchemaHandle(simpleSchema);
      const jsonSchema = handle.toJSONSchema();
      
      expect(jsonSchema).toBeDefined();
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
    });
    
    it('should preserve original schema for JSON Schema format', () => {
      const handle = new SchemaHandle(simpleSchema);
      const jsonSchema = handle.toJSONSchema();
      
      expect(jsonSchema).toBe(simpleSchema);
    });
    
    it('should construct JSON Schema for non-JSON formats', () => {
      const customSchema = {
        kind: 'interface',
        members: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };
      
      const handle = new SchemaHandle(customSchema, { format: 'typescript' });
      const jsonSchema = handle.toJSONSchema();
      
      expect(jsonSchema).toBeDefined();
      expect(jsonSchema.type).toBeDefined();
    });
  });
  
  describe('Handle Interface Compliance', () => {
    it('should support query through Handle interface', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      const result = handle.query({ type: 'schema-type' });
      expect(result).toBe('object');
    });
    
    it('should support subscribe through Handle interface', () => {
      const handle = new SchemaHandle(simpleSchema);
      const changes = [];
      
      const subscription = handle.subscribe(
        { type: 'properties' },
        (change) => changes.push(change)
      );
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      subscription.unsubscribe();
    });
    
    it('should have dataSource property', () => {
      const handle = new SchemaHandle(simpleSchema);
      
      expect(handle.dataSource).toBeDefined();
      expect(typeof handle.dataSource.query).toBe('function');
      expect(typeof handle.dataSource.subscribe).toBe('function');
      expect(typeof handle.dataSource.getSchema).toBe('function');
    });
  });
  
  describe('Nested Schema Operations', () => {
    it('should get nested schemas', () => {
      const handle = new SchemaHandle(complexSchema);
      const nested = handle.getNestedSchemas();
      
      expect(Array.isArray(nested)).toBe(true);
    });
    
    it('should handle properties with nested schemas', () => {
      const schemaWithNested = {
        type: 'object',
        properties: {
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            }
          }
        }
      };
      
      const handle = new SchemaHandle(schemaWithNested);
      const properties = handle.getProperties();
      
      const addressProperty = properties.find(p => p.name === 'address');
      expect(addressProperty).toBeDefined();
      expect(addressProperty.type).toBe('object');
    });
  });
});