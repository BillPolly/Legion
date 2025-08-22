/**
 * Unit Tests for EntityType
 * Per implementation plan Phase 4 Step 4.1
 * TDD approach - tests written first before implementation
 */

import { EntityType } from '../../../../src/immutable/schema/EntityType.js';

describe('EntityType', () => {
  describe('Constructor and Basic Properties', () => {
    test('should create entity type with name and attributes', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        optional: ['email', 'phone'],
        types: {
          name: 'string',
          age: 'number',
          email: 'string',
          phone: 'string'
        }
      });

      expect(personType.name).toBe('Person');
      expect(personType.required).toEqual(['name', 'age']);
      expect(personType.optional).toEqual(['email', 'phone']);
      expect(personType.types).toEqual({
        name: 'string',
        age: 'number',
        email: 'string',
        phone: 'string'
      });
    });

    test('should create entity type with minimal configuration', () => {
      const simpleType = new EntityType('Simple');
      
      expect(simpleType.name).toBe('Simple');
      expect(simpleType.required).toEqual([]);
      expect(simpleType.optional).toEqual([]);
      expect(simpleType.types).toEqual({});
    });

    test('should be immutable', () => {
      const type = new EntityType('Test', { required: ['field'] });
      
      expect(() => {
        type.name = 'Changed';
      }).toThrow();
      
      expect(() => {
        type.required.push('newField');
      }).toThrow();
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new EntityType(null))
        .toThrow('Entity type name is required');
      
      expect(() => new EntityType(''))
        .toThrow('Entity type name cannot be empty');
      
      expect(() => new EntityType('Test', 'not-object'))
        .toThrow('Schema must be an object');
    });
  });

  describe('Entity Validation', () => {
    let personType;

    beforeEach(() => {
      personType = new EntityType('Person', {
        required: ['name', 'age'],
        optional: ['email'],
        types: {
          name: 'string',
          age: 'number',
          email: 'string'
        }
      });
    });

    test('should validate entity with all required fields', () => {
      const entity = {
        name: 'Alice',
        age: 30
      };

      const result = personType.validate(entity);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate entity with required and optional fields', () => {
      const entity = {
        name: 'Alice',
        age: 30,
        email: 'alice@example.com'
      };

      const result = personType.validate(entity);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation when required field is missing', () => {
      const entity = {
        name: 'Alice'
        // age is missing
      };

      const result = personType.validate(entity);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'age',
        type: 'missing_required',
        message: 'Required field "age" is missing'
      });
    });

    test('should fail validation when field has wrong type', () => {
      const entity = {
        name: 'Alice',
        age: '30' // Should be number
      };

      const result = personType.validate(entity);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'age',
        type: 'type_mismatch',
        message: 'Field "age" should be of type "number" but got "string"',
        expected: 'number',
        actual: 'string'
      });
    });

    test('should fail validation with unexpected fields', () => {
      const entity = {
        name: 'Alice',
        age: 30,
        unexpected: 'value'
      };

      const result = personType.validate(entity);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'unexpected',
        type: 'unexpected_field',
        message: 'Unexpected field "unexpected"'
      });
    });

    test('should handle multiple validation errors', () => {
      const entity = {
        age: '30', // Wrong type
        unexpected: 'value' // Unexpected field
        // name is missing
      };

      const result = personType.validate(entity);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map(e => e.type)).toEqual([
        'missing_required',
        'type_mismatch',
        'unexpected_field'
      ]);
    });

    test('should validate null and undefined values correctly', () => {
      const typeWithNullable = new EntityType('Test', {
        required: ['field1'],
        optional: ['field2'],
        types: {
          field1: 'string',
          field2: 'string'
        },
        nullable: ['field2']
      });

      const entity = {
        field1: 'value',
        field2: null
      };

      const result = typeWithNullable.validate(entity);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Type Checking', () => {
    test('should support basic types', () => {
      const type = new EntityType('Test', {
        types: {
          string: 'string',
          number: 'number',
          boolean: 'boolean',
          object: 'object',
          array: 'array'
        }
      });

      expect(type.checkType('hello', 'string')).toBe(true);
      expect(type.checkType(123, 'number')).toBe(true);
      expect(type.checkType(true, 'boolean')).toBe(true);
      expect(type.checkType({}, 'object')).toBe(true);
      expect(type.checkType([], 'array')).toBe(true);

      expect(type.checkType(123, 'string')).toBe(false);
      expect(type.checkType('123', 'number')).toBe(false);
      expect(type.checkType(1, 'boolean')).toBe(false);
      expect(type.checkType([], 'object')).toBe(false);
      expect(type.checkType({}, 'array')).toBe(false);
    });

    test('should support custom type validators', () => {
      const type = new EntityType('Test', {
        types: {
          email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
          positive: (value) => typeof value === 'number' && value > 0
        }
      });

      expect(type.checkType('user@example.com', 'email')).toBe(true);
      expect(type.checkType('invalid-email', 'email')).toBe(false);
      expect(type.checkType(10, 'positive')).toBe(true);
      expect(type.checkType(-5, 'positive')).toBe(false);
    });

    test('should support array of types (union types)', () => {
      const type = new EntityType('Test', {
        types: {
          id: ['string', 'number']
        }
      });

      expect(type.checkType('abc123', 'id')).toBe(true);
      expect(type.checkType(123, 'id')).toBe(true);
      expect(type.checkType(true, 'id')).toBe(false);
    });
  });

  describe('Schema Inheritance', () => {
    test('should extend from parent type', () => {
      const animalType = new EntityType('Animal', {
        required: ['name', 'species'],
        types: {
          name: 'string',
          species: 'string'
        }
      });

      const dogType = animalType.extend('Dog', {
        required: ['breed'],
        optional: ['color'],
        types: {
          breed: 'string',
          color: 'string'
        }
      });

      expect(dogType.name).toBe('Dog');
      expect(dogType.parent).toBe(animalType);
      expect(dogType.required).toEqual(['name', 'species', 'breed']);
      expect(dogType.optional).toEqual(['color']);
      expect(dogType.types).toEqual({
        name: 'string',
        species: 'string',
        breed: 'string',
        color: 'string'
      });
    });

    test('should validate with inherited schema', () => {
      const animalType = new EntityType('Animal', {
        required: ['name'],
        types: { name: 'string' }
      });

      const dogType = animalType.extend('Dog', {
        required: ['breed'],
        types: { breed: 'string' }
      });

      const validDog = { name: 'Buddy', breed: 'Labrador' };
      const invalidDog = { breed: 'Labrador' }; // Missing name from parent

      expect(dogType.validate(validDog).isValid).toBe(true);
      expect(dogType.validate(invalidDog).isValid).toBe(false);
    });
  });

  describe('Schema Constraints', () => {
    test('should support value constraints', () => {
      const type = new EntityType('Status', {
        required: ['state'],
        types: { state: 'string' },
        constraints: {
          state: {
            enum: ['active', 'inactive', 'pending']
          }
        }
      });

      const valid = { state: 'active' };
      const invalid = { state: 'unknown' };

      expect(type.validate(valid).isValid).toBe(true);
      expect(type.validate(invalid).isValid).toBe(false);
      expect(type.validate(invalid).errors[0].type).toBe('constraint_violation');
    });

    test('should support range constraints', () => {
      const type = new EntityType('Person', {
        required: ['age'],
        types: { age: 'number' },
        constraints: {
          age: {
            min: 0,
            max: 150
          }
        }
      });

      expect(type.validate({ age: 30 }).isValid).toBe(true);
      expect(type.validate({ age: -1 }).isValid).toBe(false);
      expect(type.validate({ age: 200 }).isValid).toBe(false);
    });

    test('should support pattern constraints', () => {
      const type = new EntityType('Contact', {
        required: ['phone'],
        types: { phone: 'string' },
        constraints: {
          phone: {
            pattern: /^\d{3}-\d{3}-\d{4}$/
          }
        }
      });

      expect(type.validate({ phone: '123-456-7890' }).isValid).toBe(true);
      expect(type.validate({ phone: '1234567890' }).isValid).toBe(false);
    });

    test('should support custom constraint functions', () => {
      const type = new EntityType('Product', {
        required: ['price', 'discount'],
        types: { 
          price: 'number',
          discount: 'number'
        },
        constraints: {
          discount: {
            custom: (value, entity) => value <= entity.price * 0.5,
            message: 'Discount cannot exceed 50% of price'
          }
        }
      });

      expect(type.validate({ price: 100, discount: 30 }).isValid).toBe(true);
      expect(type.validate({ price: 100, discount: 60 }).isValid).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    test('should provide schema summary', () => {
      const type = new EntityType('Person', {
        required: ['name', 'age'],
        optional: ['email'],
        types: {
          name: 'string',
          age: 'number',
          email: 'string'
        }
      });

      const summary = type.getSchemaSummary();
      
      expect(summary).toEqual({
        name: 'Person',
        requiredCount: 2,
        optionalCount: 1,
        totalFields: 3,
        fieldTypes: {
          name: 'string',
          age: 'number',
          email: 'string'
        }
      });
    });

    test('should check if entity conforms to type', () => {
      const type = new EntityType('Simple', {
        required: ['field'],
        types: { field: 'string' }
      });

      expect(type.conforms({ field: 'value' })).toBe(true);
      expect(type.conforms({ field: 123 })).toBe(false);
      expect(type.conforms({})).toBe(false);
    });

    test('should provide meaningful string representation', () => {
      const type = new EntityType('Person', {
        required: ['name'],
        optional: ['age']
      });

      const str = type.toString();
      
      expect(str).toContain('EntityType');
      expect(str).toContain('Person');
      expect(str).toContain('required: 1');
      expect(str).toContain('optional: 1');
    });

    test('should serialize to JSON', () => {
      const type = new EntityType('Test', {
        required: ['field'],
        types: { field: 'string' }
      });

      const json = type.toJSON();
      
      expect(json).toEqual({
        name: 'Test',
        required: ['field'],
        optional: [],
        types: { field: 'string' },
        nullable: [],
        constraints: {}
      });
    });
  });
});