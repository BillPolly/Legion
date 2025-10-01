import { describe, it, expect } from '@jest/globals';
import { 
  ZodValidator, 
  createValidator, 
  createValidatorFunction,
  createAsyncValidatorFunction,
  createPredicate 
} from '../../src/ZodValidator.js';

describe('ZodValidator', () => {
  describe('Basic Validation', () => {
    it('should validate simple object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const validator = new ZodValidator(schema);
      
      const validResult = validator.validate({ name: 'John', age: 30 });
      expect(validResult.valid).toBe(true);
      expect(validResult.data).toEqual({ name: 'John', age: 30 });
      expect(validResult.errors).toBe(null);

      const invalidResult = validator.validate({ age: 30 });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.data).toBe(null);
      expect(invalidResult.errors).toBeInstanceOf(Array);
      expect(invalidResult.errors[0].path).toBe('name');
    });

    it('should handle async validation', async () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        }
      };

      const validator = new ZodValidator(schema);
      
      const validResult = await validator.validateAsync({ email: 'test@example.com' });
      expect(validResult.valid).toBe(true);
      expect(validResult.data).toEqual({ email: 'test@example.com' });

      const invalidResult = await validator.validateAsync({ email: 'not-an-email' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toBeInstanceOf(Array);
    });

    it('should handle safeParse', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };

      const validator = new ZodValidator(schema);
      
      const validResult = validator.safeParse(50);
      expect(validResult.valid).toBe(true);
      expect(validResult.data).toBe(50);

      const invalidResult = validator.safeParse(150);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toBeInstanceOf(Array);
    });

    it('should check validity with isValid', () => {
      const schema = {
        type: 'string',
        pattern: '^[A-Z][0-9]+$'
      };

      const validator = new ZodValidator(schema);
      
      expect(validator.isValid('A123')).toBe(true);
      expect(validator.isValid('abc')).toBe(false);
    });
  });

  describe('Error Formatting', () => {
    it('should format errors with path and message', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' }
            },
            required: ['name']
          }
        }
      };

      const validator = new ZodValidator(schema);
      const result = validator.validate({ user: { age: 'not-a-number' } });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const nameError = result.errors.find(e => e.path === 'user.name');
      expect(nameError).toBeDefined();
      
      const ageError = result.errors.find(e => e.path === 'user.age');
      expect(ageError).toBeDefined();
    });

    it('should support abort early option', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      };

      const validator = new ZodValidator(schema, { abortEarly: true });
      const result = validator.validate({});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.errors.length).toBe(1); // Only first error
    });

    it('should include stack trace when enabled', () => {
      const schema = { type: 'number' };
      const validator = new ZodValidator(schema, { includeStack: true });
      
      const result = validator.validate('not-a-number');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].stack).toBeDefined();
    });
  });

  describe('Schema Updates', () => {
    it('should update schema dynamically', () => {
      const initialSchema = { type: 'string' };
      const validator = new ZodValidator(initialSchema);
      
      expect(validator.isValid('hello')).toBe(true);
      expect(validator.isValid(42)).toBe(false);

      const newSchema = { type: 'number' };
      validator.updateSchema(newSchema);
      
      expect(validator.isValid('hello')).toBe(false);
      expect(validator.isValid(42)).toBe(true);
    });

    it('should clear cache when updating schema', () => {
      const schemaWithRef = {
        definitions: {
          name: { type: 'string' }
        },
        type: 'object',
        properties: {
          name: { $ref: '#/definitions/name' }
        }
      };

      const validator = new ZodValidator(schemaWithRef);
      expect(validator.isValid({ name: 'John' })).toBe(true);

      const newSchema = { type: 'array' };
      validator.updateSchema(newSchema);
      
      expect(validator.isValid({ name: 'John' })).toBe(false);
      expect(validator.isValid([])).toBe(true);
    });
  });

  describe('Function Interfaces', () => {
    it('should create validation function', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      };

      const validator = new ZodValidator(schema);
      const validateFn = validator.toFunction();
      
      const result = validateFn({ id: 123 });
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ id: 123 });
    });

    it('should create async validation function', async () => {
      const schema = { type: 'string', format: 'email' };
      
      const validator = new ZodValidator(schema);
      const validateFn = validator.toAsyncFunction();
      
      const result = await validateFn('test@example.com');
      expect(result.valid).toBe(true);
    });

    it('should create predicate function', () => {
      const schema = { type: 'boolean' };
      
      const validator = new ZodValidator(schema);
      const predicateFn = validator.toPredicate();
      
      expect(predicateFn(true)).toBe(true);
      expect(predicateFn(false)).toBe(true);
      expect(predicateFn('string')).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('should create validator with createValidator', () => {
      const schema = { type: 'string' };
      const validator = createValidator(schema);
      
      expect(validator).toBeInstanceOf(ZodValidator);
      expect(validator.isValid('hello')).toBe(true);
    });

    it('should create validation function with createValidatorFunction', () => {
      const schema = { type: 'number', minimum: 0 };
      const validateFn = createValidatorFunction(schema);
      
      const result = validateFn(5);
      expect(result.valid).toBe(true);
      expect(result.data).toBe(5);
    });

    it('should create async validation function', async () => {
      const schema = { type: 'array', items: { type: 'string' } };
      const validateFn = createAsyncValidatorFunction(schema);
      
      const result = await validateFn(['a', 'b', 'c']);
      expect(result.valid).toBe(true);
    });

    it('should create predicate with createPredicate', () => {
      const schema = { 
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        }
      };
      const isValid = createPredicate(schema);
      
      expect(isValid({ x: 1, y: 2 })).toBe(true);
      expect(isValid({ x: 'not-a-number' })).toBe(false);
    });
  });

  describe('Options', () => {
    it('should handle type coercion', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
          active: { type: 'boolean' }
        }
      };

      const validator = new ZodValidator(schema, { coerceTypes: true });
      
      const result = validator.validate({
        count: '42',
        active: 'true'
      });
      
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        count: 42,
        active: true
      });
    });

    it('should handle custom formats', () => {
      const customFormats = {
        'custom-id': (schema) => schema.regex(/^ID-[0-9]{4}$/)
      };

      const schema = {
        type: 'string',
        format: 'custom-id'
      };

      const validator = new ZodValidator(schema, { customFormats });
      
      expect(validator.isValid('ID-1234')).toBe(true);
      expect(validator.isValid('ID-123')).toBe(false);
      expect(validator.isValid('1234')).toBe(false);
    });

    it('should handle strict mode', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      };

      const validator = new ZodValidator(schema, { strictMode: true });
      
      const result = validator.validate({
        name: 'John',
        extra: 'field'
      });
      
      expect(result.valid).toBe(false);
    });
  });

  describe('Complex Schemas', () => {
    it('should handle nested objects with references', () => {
      const schema = {
        definitions: {
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              zipCode: { type: 'string', pattern: '^[0-9]{5}$' }
            },
            required: ['street', 'city']
          }
        },
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
          address: { $ref: '#/definitions/address' }
        },
        required: ['name']
      };

      const validator = new ZodValidator(schema);
      
      const validData = {
        name: 'John Doe',
        age: 30,
        address: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001'
        }
      };
      
      const result = validator.validate(validData);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validData);

      const invalidData = {
        name: 'John Doe',
        address: {
          city: 'New York'  // Missing required 'street'
        }
      };
      
      const invalidResult = validator.validate(invalidData);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.some(e => e.path.includes('street'))).toBe(true);
    });

    it('should handle oneOf with discriminated unions', () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'car' },
              wheels: { type: 'number', const: 4 }
            }
          },
          {
            type: 'object',
            properties: {
              type: { const: 'bike' },
              wheels: { type: 'number', const: 2 }
            }
          }
        ]
      };

      const validator = new ZodValidator(schema);
      
      expect(validator.isValid({ type: 'car', wheels: 4 })).toBe(true);
      expect(validator.isValid({ type: 'bike', wheels: 2 })).toBe(true);
      expect(validator.isValid({ type: 'car', wheels: 2 })).toBe(false);
    });
  });

  describe('Access Methods', () => {
    it('should get Zod schema', () => {
      const schema = { type: 'string' };
      const validator = new ZodValidator(schema);
      
      const zodSchema = validator.getZodSchema();
      expect(zodSchema).toBeDefined();
      expect(zodSchema.parse('hello')).toBe('hello');
    });

    it('should get JSON schema', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      };
      const validator = new ZodValidator(schema);
      
      const jsonSchema = validator.getJsonSchema();
      expect(jsonSchema).toEqual(schema);
    });
  });
});