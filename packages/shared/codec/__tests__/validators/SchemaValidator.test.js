/**
 * Tests for SchemaValidator class
 */

import { SchemaValidator } from '../../src/validators/SchemaValidator.js';
import { createTestSchemas } from '../utils/testUtils.js';

describe('SchemaValidator', () => {
  let validator;
  let testSchemas;

  beforeEach(() => {
    validator = new SchemaValidator();
    testSchemas = createTestSchemas();
  });

  describe('Constructor and Initialization', () => {
    test('creates validator with default options', () => {
      const validator = new SchemaValidator();
      expect(validator).toBeInstanceOf(SchemaValidator);
      expect(validator.ajv).toBeDefined();
      expect(validator.compiledSchemas).toBeInstanceOf(Map);
      expect(validator.compiledSchemas.size).toBe(0);
    });

    test('creates validator with custom options', () => {
      const customOptions = {
        allErrors: false,
        verbose: false
      };
      const validator = new SchemaValidator(customOptions);
      expect(validator).toBeInstanceOf(SchemaValidator);
    });

    test('initializes with empty compiled schemas cache', () => {
      expect(validator.getSchemaIds()).toEqual([]);
    });
  });

  describe('addSchema method', () => {
    test('successfully adds valid schema', () => {
      const result = validator.addSchema('test_schema', testSchemas.simpleMessage);
      expect(result).toBe(true);
      expect(validator.getSchemaIds()).toContain('test_schema');
    });

    test('throws error for invalid schema', () => {
      const invalidSchema = {
        type: 'invalid_type' // Not a valid JSON Schema type
      };
      
      expect(() => {
        validator.addSchema('invalid_schema', invalidSchema);
      }).toThrow(/Failed to compile schema/);
    });

    test('allows overwriting existing schema', () => {
      validator.addSchema('test_schema', testSchemas.simpleMessage);
      expect(validator.getSchemaIds()).toContain('test_schema');
      
      // Overwrite with different schema
      const result = validator.addSchema('test_schema', testSchemas.complexMessage);
      expect(result).toBe(true);
      expect(validator.getSchemaIds()).toContain('test_schema');
    });

    test('handles complex nested schema', () => {
      const result = validator.addSchema('complex_schema', testSchemas.complexMessage);
      expect(result).toBe(true);
    });
  });

  describe('validate method', () => {
    beforeEach(() => {
      validator.addSchema('simple_message', testSchemas.simpleMessage);
      validator.addSchema('complex_message', testSchemas.complexMessage);
    });

    test('validates correct data successfully', () => {
      const validData = {
        type: 'simple_message',
        content: 'Hello world',
        messageId: 'msg_123',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('simple_message', validData);
      expectSuccess(result);
      expect(result.data).toEqual(validData);
    });

    test('returns error for unknown schema', () => {
      const result = validator.validate('unknown_schema', {});
      expectError(result, 'Schema \'unknown_schema\' not found');
      expect(result.data).toBe(null);
    });

    test('returns validation errors for invalid data', () => {
      const invalidData = {
        type: 'simple_message',
        // Missing required 'content' field
        messageId: 'msg_123'
      };

      const result = validator.validate('simple_message', invalidData);
      expectError(result);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('message');
      expect(result.errors[0]).toHaveProperty('path');
    });

    test('validates complex nested data', () => {
      const validComplexData = {
        type: 'complex_message',
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com'
        },
        items: [
          { name: 'item1', value: 42 },
          { name: 'item2', value: 84 }
        ],
        messageId: 'msg_456',
        timestamp: '2025-07-28T16:30:00.000Z'
      };

      const result = validator.validate('complex_message', validComplexData);
      expectSuccess(result);
      expect(result.data).toEqual(validComplexData);
    });

    test('returns detailed errors for complex validation failures', () => {
      const invalidComplexData = {
        type: 'complex_message',
        user: {
          id: 'user123',
          username: '', // Too short
          email: 'not-an-email' // Invalid format
        },
        items: [
          { name: 'item1' } // Missing 'value' field
        ]
      };

      const result = validator.validate('complex_message', invalidComplexData);
      expectError(result);
      expect(result.errors.length).toBeGreaterThan(1); // Multiple validation errors
    });

    test('handles format validation (email, date-time)', () => {
      const dataWithBadEmail = {
        type: 'complex_message',
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'invalid-email'
        },
        items: []
      };

      const result = validator.validate('complex_message', dataWithBadEmail);
      expectError(result);
      expect(result.errors.some(error => 
        error.message.includes('format')
      )).toBe(true);
    });
  });

  describe('Schema management methods', () => {
    beforeEach(() => {
      validator.addSchema('schema1', testSchemas.simpleMessage);
      validator.addSchema('schema2', testSchemas.complexMessage);
    });

    test('getSchemaIds returns all schema IDs', () => {
      const ids = validator.getSchemaIds();
      expect(ids).toContain('schema1');
      expect(ids).toContain('schema2');
      expect(ids).toHaveLength(2);
    });

    test('getSchema returns schema definition', () => {
      const schema = validator.getSchema('schema1');
      expect(schema).toEqual(testSchemas.simpleMessage);
    });

    test('getSchema returns null for unknown schema', () => {
      const schema = validator.getSchema('unknown');
      expect(schema).toBe(null);
    });

    test('removeSchema removes schema successfully', () => {
      expect(validator.getSchemaIds()).toContain('schema1');
      const result = validator.removeSchema('schema1');
      expect(result).toBe(true);
      expect(validator.getSchemaIds()).not.toContain('schema1');
    });

    test('removeSchema returns false for unknown schema', () => {
      const result = validator.removeSchema('unknown');
      expect(result).toBe(false);
    });

    test('clear removes all schemas', () => {
      expect(validator.getSchemaIds()).toHaveLength(2);
      validator.clear();
      expect(validator.getSchemaIds()).toHaveLength(0);
    });
  });
});